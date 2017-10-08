var turf = require('@turf/turf');
var polyUtil = require('polyline-encoded');
var request = require("request");
var Promise = require("promise");

//DATASETS
//ELEVATION
var elevation = require('./data/elevation_SGP.json');
var origin = [103.6, 1.16];
var pixel_size = 0.0002; // Pixels are squares
//PCN
var pcn_access_points = require('./data/all_pcn_access_points.json');
var pcn = require('./data/all_pcn.json');
var national_parks = require('./data/bb_parks.json');

//------------------------------- INTERNAL SERVER CALLS TO ONEMAP ---------------------------------------------------//
function routeReq(start, end, mode) {
    var start_point = start.slice().reverse();
    var end_point = end.slice().reverse();
    var mode = mode;

    var route_options = {
        method: "GET",
        url: "http://onemap.duckdns.org/onemap/route",
        qs: {
            start: start_point.toString(),
            end: end_point.toString(),
            routeType: mode
        }
    };

    function async() {
        return new Promise(function (resolve, reject) {
            request(route_options, function (err, response, body) {
                if (err) {
                    return reject(err);
                }
                // console.log(response.statusCode);
                else {
                    return resolve(body);
                }
            });
        });
    }

    return async().then(function (body) {

        var result = JSON.parse(body);

        function feature_from_api(featurejson) {
            var properties = {
                "route_instructions": featurejson["route_instructions"],
                "route_name": featurejson["route_name"],
                "route_summary": featurejson["route_summary"]
            };
            var encoded = featurejson["route_geometry"];
            if (encoded !== undefined || encoded !== '' || encoded != null) {
                var latlngs = polyUtil.decode(encoded);
                var coords = latlngs.map(function (list) {
                    return list.slice().reverse();
                });
            } else {
                coords = [];
            }
            return turf.lineString(coords, properties);
        }

        var parsed_result = {
            main: feature_from_api(result)
        };
        // parsed_result["alternative"] = [];
        // if (result["alternativeroute"]) {
        //     for (var i = 0; i < result["alternativeroute"].length; i++) {
        //         parsed_result["alternative"][i] = feature_from_api(result["alternativeroute"][i]);
        //     }
        // }
//        console.log(parsed_result);
        return parsed_result;
    }).catch(function (err) {
        console.log("%s", err);
    });
}

//--------------------------------------------------------------------------------------------------------------------//

//---------------------------------------- ELEVATION & DIFFICULTY FUNCTIONS ------------------------------------------//
/**
 * Converts a GeoJSON point to a pixel based on the
 * Singapore elevation map from NASA's data. Coordinates
 * are snapped to the bottom left of each pixel.
 * Assumes given point is within the map, otherwise UB
 *
 * @param p    point (long, lat)
 * @return        Pos of corresponding pixel in 0-indexed 2D array
 */
function pointToPixel(p) {
    // return [Math.floor((p.coordinates[0] - origin[0])/pixel_size),
    //     Math.floor((p.coordinates[1] - origin[1])/pixel_size)];
    return [Math.floor((p[0] - origin[0]) / pixel_size),
        Math.floor((p[1] - origin[1]) / pixel_size)];
}

function lonlatToPixel(pair) {
    return [Math.floor((pair[0] - origin[0]) / pixel_size),
        Math.floor((pair[1] - origin[1]) / pixel_size)];
}

/**
 * Obtains the elevation of a given point by querying
 * the database
 *
 * @param p    point
 * @return        Elevation of point, in metres
 */

function getElevation(p) {
    var pixelLoc = pointToPixel(p);
    // console.log(pixelLoc);
    //queryDBElevation(pixelLoc[0], pixelLoc[1]);
    return elevation[pixelLoc[0]][pixelLoc[1]];
}

function getElevationFromCoords(pair) {
    var pixelcoords = lonlatToPixel(pair);
    return elevation[pixelcoords[0]][pixelcoords[1]];
}


/**
 * Extract the climbs from a route. A climb is stored as
 * a tuple of (<start>, <end>), where each marker consists
 * of geographical data in the form (<point>, <elevation>)
 *
 * @param route    A line of points, representing the route
 * @return            An array of climbs along the route
 */
function getClimbs(route) {
    var elevations = route.map(getElevationFromCoords);
    var step_size = 1; // Define sampling rate
    // Initialize
    var climbs = [];
    var climb_start = 0;
    var work_done = 0;
    var climbing = false;
    for (var i = step_size, len = route.length; i < len; i += step_size) {
        if (climbing && elevations[climb_start] <= elevations[i]) {
            // Climb ended, record it
            climbing = false;
            climbs.push([[route[climb_start], elevations[climb_start]],
                [route[i], elevations[i]]]);
        } else if (!climbing && elevations[i] > elevations[i - step_size]) {
            // Start a climb
            climbing = true;
            climb_start = i - step_size;
        }
    }
    return climbs;
}

// Define the difficulties
var level = [[0.25, 0.25], [0.5, 0.5], [1, 1]];

/**
 * Gets the difficulty of a climb.
 *
 * The intuition is that every climb requires a
 * sustained effort over time, and thus can be
 * represented by a point on the <Time>/<Power> graph.
 * The maximum time a human can sustain a particular
 * level of effort can be approximated by the
 * curve: <Time> = k/<Power> + c
 * This curve shifts out with increasing athletic
 * ability.
 * <Time> = <dist> / <a constant>
 * <grade> = <rise> / <dist>
 * <Power> = <grade> * <a constant>
 *
 * Therefore we can consider <dist> = k/<grade> + c
 * and define 3 difficulty regions by calibrating the
 * constants k and c
 *        Lvl 1: k = 1, c = 1
 *        Lvl 2: k = 2, c = 2
 *        Lvl 3: k = 3, c = 3
 *
 * A climb (i.e. a (<grade>, <dist>) point) bounded
 * by the difficulty curve and the axes is considered
 * suitable for that level of difficulty.
 * The difficulty of said climb will be the closest
 * suitable difficulty.
 *
 * Source: https://www.wired.com/2013/03/whats-the-steepest-gradient-for-a-road-bike/
 *
 * @param climb    The climb to analyse
 * @return            The difficulty of the climb [1-5]
 */
function getClimbDifficulty(climb) {
    //turfjs distance is in km
    var dist = turf.distance(turf.point(climb[0][0]), turf.point(climb[1][0]), "kilometers");
    var grade = (climb[1][1] - climb[0][1]) / dist;
    var maxLevel = level.length;
    for (var i = 0; i < maxLevel; i++) {
        //Within difficulty i+1?
        if (dist <= level[i][0] / grade + level[i][1]) {
            return i + 1;
        }
    }
    // Off the charts difficulty, return highest difficulty
    return maxLevel;
}

/**
 * Returns the difficulty of a route
 *
 * @param route    A line
 * @return            The difficulty level of the route
 */
function getRouteDifficulty(route) {
    var climbs = getClimbs(route);
    // console.log(climbs);
    if (climbs.length === 0) {
        return 1;
    } else {
        return Math.max(...climbs.map(getClimbDifficulty)
    )
        ;
    }
}

//--------------------------------------------------------------------------------------------------------------------//

//---------------------------------------- GEOOBJECTS PROCESSING------------------------------------------------------//
//Helper Functions
function isPointonLine(line, point) {
    var snapped_point = turf.pointOnLine(line, point, 'kilometers')
    return snapped_point["properties"]["dist"] < 0.000001;
}

function isSamePoint(point1, point2) {
    var point1_coords = turf.getCoord(point1);
    var point2_coords = turf.getCoord(point2);
    return Math.abs(point1_coords[0] - point2_coords[0]) < 0.0001 && Math.abs(point1_coords[1] - point2_coords[1]) < 0.0001;
}

function mergeFeatureCollections(featCol_arr) {
    var feature_array = [];
    for (var i = 0; i < featCol_arr.length; i++) {
        feature_array = feature_array.concat(featCol_arr[i]["features"]);
    }
    return turf.featureCollection(feature_array);
}


// Distance Functions
function distanceTwoPointsonLine(pt1, pt2, line) {
    var sliced_line = turf.lineSlice(pt1, pt2, line);
    return turf.lineDistance(sliced_line, 'kilometers');
}

function distanceTwoPoints(pt1, pt2) {
    var line = turf.linestring([pt1, pt2]);
    return turf.lineDistance(line, 'kilometers');
}

//Routing Functions

// POINT BASED

function getPointsAround(pt, radius, dataset) {
    var circle_around_point = turf.circle(pt, radius, 10)
    var circle_collection = turf.featureCollection([
        circle_around_point]);
    return turf.within(dataset, circle_collection);
}

function getNearestEntryPoint(pt) {
    return turf.featureCollection(turf.nearest(pt, pcn_access_points));
}

// REGION OF INTEREST BASED

function regionofInterest(pt, radius) {
    var circle_around_point = turf.circle(pt, radius, 10);
    return turf.featureCollection([circle_around_point]);
}

function boundingBox(bbox) {
    var bbox_Poly = turf.bboxPolygon(bbox);
    return turf.featureCollection([bbox_Poly]);
}

function getPointsinROI(ROI, dataset) {
    return turf.within(dataset, ROI);
}

function getRoutesinROI(ROI, dataset) {
    var feat_col = [];
    var ROI_feature = ROI.features[0];
    turf.featureEach(dataset, function (currentFeature, featureIndex) {
        if (turf.lineIntersect(currentFeature, ROI_feature) !== 'undefined') {
            feat_col.push(currentFeature);
        }
    });
    return turf.featureCollection(feat_col);
}

function appendRouteID(points, routes) {
    var point_col = [];
    turf.featureEach(points, function (currentPoint, pointIndex) {
        turf.featureEach(routes, function (currentRoute, pointIndex) {
            if (isPointonLine(currentRoute, currentPoint)) {
                point_col.push([currentPoint, currentRoute["id"]]);
            }
        });
    });
    return point_col;
}

// INTERMEDIATES

function getRoutesfromEntryPoints(entry_pts) {
    var routes_array = [];
    var pts_array = entry_pts["features"];
    var lines_array = pcn["features"];
    for (var i = 0; i < lines_array.length; i++) {
        for (var j = 0; j < pts_array.length; j++) {
            if (isPointonLine(lines_array[i], pts_array[j])) {
                routes_array.push(lines_array[i]);
            }
        }
    }

    return turf.featureCollection(routes_array);
}

function appendDifficultytoRoutes(routesArray) {
    for (var i = 0; i < routesArray.length; i++) {
        var route = routesArray[i]["features"][0];
        var difficulty = getRouteDifficulty(turf.getCoords(route));
        route["difficulty"] = difficulty;
        //console.log(route["difficulty"]);
    }
    return routesArray;
}

function appendDistancetoRoutes(routesArray) {
    for (var i = 0; i < routesArray.length; i++) {
        var route = routesArray[i]["features"][0];
        var distance = turf.lineDistance(route, 'kilometers');
        route["distance"] = distance;
        //console.log(route["distance"]);
    }
    return routesArray;
}

function filterbyDifficulty(diff, routesArray) {
    var filteredroutes = [];
    for (var i = 0; i < routesArray.length; i++) {
        var route = routesArray[i]["features"][0];
        if (route["difficulty"] <= diff) {
            filteredroutes.push(routesArray[i]);
        }
    }

    return routesArray;
}

function filterbyDistance(dist, routesArray) {
    var filteredroutes = [];
    for (var i = 0; i < routesArray.length; i++) {
        var route = routesArray[i]["features"][0];
        if (route["difficulty"] <= dist) {
            filteredroutes.push(routesArray[i]);
        }
    }

    return routesArray;
}


//--------------------------------------------------------------------------------------------------------------------//
// MAIN API HERE ------------------------------------------------------------------------------------------------------>
function get_dijkstra_routes(start_node, end_node, distance, node_pairs) {
    node_pairs.push([end_node, "end"]);
    var possible_routes = [];
    var max_pcn_count = 0;

    function dijkstra_helper(accum_list, beginning_node, node_list, pcn_count, distance_left) {

        if (distance_left < 0 || node_list.length === 0) {
            return [];
        } else if (beginning_node[1] === "end") {
            return pcn_count === 0 ? [] : accum_list;
        } else {
            for (var i = 0; i < node_list.length; i++) {
                var x = node_list[i];
                var distance_from_beginning = turf.distance(beginning_node[0], x[0]);
                var distance_carry = distance_left - distance_from_beginning;
                var remaining_node_list = node_list.slice();
                var accum_list_i = []
                var pcn_count_carry = pcn_count;
                remaining_node_list.splice(i, 1);
                if (x[1] === "end") {
                    accum_list_i = dijkstra_helper(accum_list.concat([x]), x, remaining_node_list, pcn_count_carry, distance_carry);
                } else if (beginning_node[1] === x[1]) {
                    pcn_count_carry = pcn_count_carry + 1;
                    accum_list_i = dijkstra_helper(accum_list.concat([x]), x, remaining_node_list, pcn_count_carry, distance_carry);
                } else {
                    accum_list_i = dijkstra_helper(accum_list.concat([[x[0], "not_connected"]]), x, remaining_node_list, pcn_count_carry, distance_carry);
                }
            }
            possible_routes = possible_routes.concat(accum_list_i.length === 0 ? [] : [[accum_list_i, pcn_count]]);
            max_pcn_count = Math.max(max_pcn_count, pcn_count);
        }
    }

    dijkstra_helper([], [start_node, "start"], node_pairs, 0, distance);
    var best_routes = [];
    for (var i = 0; i < possible_routes.length; i++) {
        if (possible_routes[i][1] === max_pcn_count - 1) {
            best_routes.push(possible_routes[i][0]);
        }
    }
    return best_routes.map(function (currentValue, index) {
        return [[start_node, "start"]].concat(currentValue);
    });
}


function dijkstra_route(mode, start_point, end_point, distance, difficulty) {
    var start = turf.point(start_point);
    var end = turf.point(end_point);
    if (distance <= turf.distance(start, end)) {
        return false;
    } else {
        var midpoint = turf.midpoint(start, end);
        var area_of_interest = regionofInterest(midpoint, distance / 2);
        var EntryPoints = getPointsinROI(area_of_interest, pcn_access_points);
        var PCNRoutes = getRoutesinROI(area_of_interest, pcn);
        var annotatedEntryPoints = appendRouteID(EntryPoints, PCNRoutes);
        var best_routes = get_dijkstra_routes(start, end, distance, annotatedEntryPoints);
        return connect_node_array(best_routes, mode, PCNRoutes)
            .then(appendDifficultytoRoutes)
            .then(appendDistancetoRoutes)
            .then(function (x) {
                console.log(x[0].features[0].difficulty);
                return filterbyDifficulty(difficulty, x);
            })
            .then(function (x) {
                return filterbyDistance(distance, x);
            });
    }
}

function connect_node_array(array_of_node_array, mode, PCNroutes) {
    var first_route = array_of_node_array[0];
    var connected_coords = [];
    for (var i = 0; i < first_route.length - 1; i++) {
        var current_node = first_route[i];
        var next_node = first_route[i + 1];
        //if same pcn
        if (next_node[1] !== "not_connected" && next_node[1] !== "end") {
            //connect_by_pcn_of_id
            turf.featureEach(PCNroutes, function (currentRoute, index) {
                if (currentRoute.id === next_node[1]) {
                    var sliced_route = turf.lineSlice(current_node[0], next_node[0], currentRoute);
                    connected_coords[i] = isSamePoint(turf.point(turf.getCoords(sliced_route)[0]), current_node[0]) ? turf.getCoords(sliced_route) : turf.getCoords(sliced_route).slice().reverse();
                }
            });
        } else {
            var current_coords = turf.getCoord(current_node[0]);
            var next_coords = turf.getCoord(next_node[0]);
            connected_coords[i] = routeReq(current_coords, next_coords, mode).then(function (x) {
                return turf.getCoords(x["main"]);
            });
        }
    }

    return Promise.all(connected_coords).then(function (res) {
        var full_coords = [];
        for (var i = 0; i < res.length; i++) {
            full_coords = full_coords.concat(res[i]);
        }
        return [turf.featureCollection([turf.lineString(full_coords)])];
    });
}
exports.get_features = function (req, res) {
    var mode = req.query.mode;
    var start_point = req.query.start;
    var end_point = req.query.end;
    var distance = parseInt(req.query.dist);
    var difficulty = parseInt(req.query.diff);

    var sp_array = JSON.parse("[" + start_point + "]");
    var ep_array = JSON.parse("[" + end_point + "]");

//    getFeaturesonReq(mode, sp_array, ep_array, distance, difficulty).then(function (result) {
    dijkstra_route(mode, sp_array, ep_array, distance, difficulty).then(function (result) {
        console.log(result);
        res.send(result);
    }).catch(function (err) {
        console.log("%s", err);
    });
};

