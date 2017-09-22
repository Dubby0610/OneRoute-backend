// Coordinates at lower left corner. long increases towards right, lat increases towards top
var elevation = elevation_SGP;
var origin = [103.6, 1.16];
var pixel_size = 0.0002; // Pixels are squares
/**
 * Converts a GeoJSON point to a pixel based on the
 * Singapore elevation map from NASA's data. Coordinates
 * are snapped to the bottom left of each pixel.
 * Assumes given point is within the map, otherwise UB
 *
 * @param p 	point (long, lat)
 * @return 		Pos of corresponding pixel in 0-indexed 2D array
 */
function pointToPixel(p){
    // return [Math.floor((p.coordinates[0] - origin[0])/pixel_size),
    //     Math.floor((p.coordinates[1] - origin[1])/pixel_size)];
    return [Math.floor((p[0] - origin[0])/pixel_size),
        Math.floor((p[1] - origin[1])/pixel_size)];
}

function lonlatToPixel(pair) {
    return [Math.floor((pair[0] - origin[0])/pixel_size),
        Math.floor((pair[1] - origin[1])/pixel_size)];
}

/**
 * Obtains the elevation of a given point by querying
 * the database
 *
 * @param p 	point
 * @return 		Elevation of point, in metres
 */

function getElevation(p){
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
 * @param route 	A line of points, representing the route
 * @return 			An array of climbs along the route
 */
function getClimbs(route){
    var elevations = route.map(getElevationFromCoords);
    var step_size = 1; // Define sampling rate
    // Initialize
    var climbs = [];
    var climb_start = 0;
    var work_done = 0;
    var climbing = false;
    for(var i=step_size, len=route.length; i < len; i+=step_size){
        if(climbing && elevations[climb_start] <= elevations[i]){
            // Climb ended, record it
            climbing = false;
            climbs.push([[route[climb_start], elevations[climb_start]],
                [route[i], elevations[i]]]);
        } else if(!climbing && elevations[i] > elevations[i-step_size]){
            // Start a climb
            climbing = true;
            climb_start = i-step_size;
        }
    }
    return climbs;
}

// Define the difficulties
var level = [[0.25,0.25], [0.5,0.5], [1,1]];

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
 * 		Lvl 1: k = 1, c = 1
 *		Lvl 2: k = 2, c = 2
 *		Lvl 3: k = 3, c = 3
 *
 * A climb (i.e. a (<grade>, <dist>) point) bounded
 * by the difficulty curve and the axes is considered
 * suitable for that level of difficulty.
 * The difficulty of said climb will be the closest
 * suitable difficulty.
 *
 * Source: https://www.wired.com/2013/03/whats-the-steepest-gradient-for-a-road-bike/
 *
 * @param climb 	The climb to analyse
 * @return 			The difficulty of the climb [1-5]
 */
function getClimbDifficulty(climb){
    //turfjs distance is in km
    var dist = turf.distance(turf.point(climb[0][0]), turf.point(climb[1][0]), "kilometers");
    var grade = (climb[1][1] - climb[0][1]) / dist;
    var maxLevel = level.length;
    for(var i = 0; i < maxLevel; i++){
        //Within difficulty i+1?
        if(dist <= level[i][0] / grade + level[i][1]){
            return i+1;
        }
    }
    // Off the charts difficulty, return highest difficulty
    return maxLevel;
}

/**
 * Returns the difficulty of a route
 *
 * @param route 	A line
 * @return 			The difficulty level of the route
 */
function getRouteDifficulty(route){
    var climbs = getClimbs(route);
    // console.log(climbs);
    if (climbs.length === 0) {
        return 1;
    } else {
        return Math.max(...climbs.map(getClimbDifficulty));
    }
}

//Route test
var pcn_access = all_pcn;

var ret = [];
for (var i = 0; i < pcn_access["features"].length; i++) {

    ret.push({
        "name": pcn_access["features"][i]["properties"]["PARK"],
        "difficulty": getRouteDifficulty(pcn_access["features"][i]["geometry"]["coordinates"])
    });
}

// var diff_str = JSONtoString(ret);
// $(document).ready(function () {
//     $("#diff").text(diff_str);
// });