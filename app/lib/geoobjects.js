/*

BACKEND PROCESSING

turf.js
-npm
	install @turf/intersect
-npm
	install @turf/nearest
-npm
	install @turf/circle
-npm
	install @turf/line-overlap
-npm
	install @turf/point-on-line
-npm
	install @turf/inside
-npm
	install @turf/line-slice



DATASET PROCESSING

toGeoJson

	-npm install -g @mapbox/togeojson


using jQuery:
GET OneMap Routing API


function getPoint(from_frontend) {

	returns Point (x, y)

}



function nearestFeatures(Point, Radius, FeatureSet) {

    returns FeatureCollection (JSON of GeoJSON features)

}



function route_OneMap(Point, Point, movement_var [walk, cycle, drive, pt]) {

    returns one_map API call for routing between 2 points

}



 */

var testpoint = turf.point([103.7349, 1.3572]);
// Datasets
var pcn_access_points = bb_pcn_access_points;
var pcn = bb_pcn;
var national_parks = bb_parks;


//Helper Functions
function isPointonLine(line, point) {
    var snapped_point = turf.pointOnLine(line, point, 'kilometers')
    return snapped_point["properties"]["dist"] < 0.000001;
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

// Formatting functions
function routestoFeatureCollectionArray(routes, entry_points) {
    var featCol_array = [];
    var pts_array = entry_points["features"];
    var lines_array = routes["features"];
    for (var i = 0; i < lines_array.length; i++) {
        featCol_array[i] = [lines_array[i]];
        for (var j = 0; j < pts_array.length; j++) {
            if (isPointonLine(lines_array[i], pts_array[j])) {
                featCol_array[i].push(pts_array[j]);
            }
        }
        featCol_array[i] = turf.featureCollection(featCol_array[i]);
    }
    return featCol_array;
}


function remove_description(featureCol) {
    var feature_array = featureCol["features"];
    for (var i = 0; i < feature_array.length; i++) {
        delete feature_array[i]["properties"]["description"];
    }
    return featureCol
}

function JSONtoString(x) {
    return JSON.stringify(x, null, 4);
}

// APIs
function getPCN(pt, radius) {
    var inputPoint = turf.point(pt);
    var nearbyEntryPoints = getPointsAround(inputPoint, radius, pcn_access_points);
    var nearbyRoutes = getRoutesfromEntryPoints(nearbyEntryPoints);


    var feat_array = [inputPoint];
    feat_array = feat_array.concat(turf.circle(inputPoint, radius, 10));
    feat_array = feat_array.concat(nearbyEntryPoints["features"]);
    feat_array = feat_array.concat(nearbyRoutes["features"]);

    return turf.featureCollection(feat_array);
}

function getFeatures(pt, radius) {
    var inputPoint = turf.point(pt);
    var inputROI = regionofInterest(inputPoint, radius);
    var nearbyEntryPoints = getPointsinROI(inputROI, pcn_access_points);
    var nearbyParks = getPointsinROI(inputROI, national_parks);
    var nearbyRoutes = getRoutesfromEntryPoints(nearbyEntryPoints);
    var routeFeatColArray = routestoFeatureCollectionArray(nearbyRoutes, nearbyEntryPoints);

    var feat_col_arr = [
        turf.featureCollection([inputPoint]),
        inputROI,
        nearbyEntryPoints,
        nearbyParks,
        nearbyRoutes
    ];

    return mergeFeatureCollections(feat_col_arr);
}

function getFeaturesBbox(bbox) {
    var bbox_Polygon = boundingBox(bbox);
    var nearbyEntryPoints = getPointsinROI(bbox_Polygon, pcn_access_points);
    var nearbyParks = getPointsinROI(bbox_Polygon, national_parks);
    var nearbyRoutes = getRoutesfromEntryPoints(nearbyEntryPoints);

    var feat_col_arr = [
        bbox_Polygon,
        nearbyEntryPoints,
        nearbyParks,
        nearbyRoutes
    ];

    return mergeFeatureCollections(feat_col_arr);
}

//Frontend Test

// var test_str = JSONtoString(getEntryPointsAround(testpoint, 1.5));
// var test_str = JSONtoString(remove_description(getRoutesfromEntryPoints(getEntryPointsAround(testpoint, 1.5))));
// var test_str = JSONtoString(remove_description(getRoutes([103.7349, 1.3572], 1.5)));
// var test_str = JSONtoString(remove_description(getFeatures([103.7349, 1.3572], 3)));
var test_str = JSONtoString(remove_description(getFeaturesBbox([103.7349, 1.3572, 103.80, 1.37])));
$(document).ready(function () {
    $("#test").text(test_str);
    routeReq([103.73, 1.3572], [103.80, 1.37], "cycle");

});
