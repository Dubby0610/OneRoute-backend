'use strict';
var turf = require('@turf/turf');
var polyline = require('@mapbox/polyline');
var request = require("request");

function routeReq (start, end, mode) {
    var start_point = start;
    var end_point = end;
    var mode = mode;

    var route_options = {
        method: "GET",
        url: "http://onemap.duckdns.org/onemap/route",
        qs: {
            start: start_point,
            end: end_point,
            routeType: mode
        }
    };
    var parsed_result = {};
    request(route_options, function(err, response, body) {
        if (err) throw new Error(err);
        console.log(body);
        var result = JSON.parse(body);

        function featuregeom(featurejson) {
            return {
                "type": "LineString",
                "coordinates": polyline.decode(featurejson["route_geometry"]),
                "properties": {
                    "route_instructions": featurejson["route_instructions"],
                    "route_name": featurejson["route_name"],
                    "route_summary": featurejson["route_summary"]
                }
            }
        }

        parsed_result["main"] = turf.feature(featuregeom(result));
        parsed_result["alternative"] = [];
        if (result["alternativeroute"]) {
            for (var i = 0; i < result["alternativeroute"].length; i++) {
                parsed_result["alternative"][i] = turf.feature(featuregeom(result["alternativeroute"][i]))
            }
        }
        console.log(parsed_result);
    });

    return parsed_result;
}

function searchReq (searchVal) {

    var search_options = {
        method: "GET",
        url: "http://onemap.duckdns.org/search",
        qs: {
            searchVal: searchVal,
            getAddrDetails: "Y",
            returnGeom: "N"
        }
    };
    var array_of_features = [];
    request(search_options, function(err, response, body) {
        if (err) throw new Error(err);
        console.log(body);
        var result = JSON.parse(data);


        function featurepoint(pointjson) {
            return {
                "type": "Point",
                "coordinates": turf.Point(pointjson["LONGITUDE"], pointjson["LATITUDE"]),
                "properties": {
                    "name": pointjson["SEARCHVAL"],
                    "address": pointjson["ADDRESS"]
                }
            }
        }

        for (var i = 0; i < result["results"].length; i++) {
            array_of_features[i] = turf.feature(featurepoint(result["results"][i]))
        }
        console.log(array_of_features);
    });

    return array_of_features;
}
