'use strict';
var turf = require('@turf/turf');
var polyline = require('@mapbox/polyline');
var request = require("request");

exports.request_route = function (req, res) {
    var start_point = req.query.start;
    var end_point = req.query.end;
    var mode = req.query.mode;

    var route_options = {
        method: "GET",
        url: "http://onemap.duckdns.org/onemap/route",
        qs: {
            start: start_point,
            end: end_point,
            routeType: mode
        }
    };

    request(route_options, function(err, response, body) {
        if (err) throw new Error(err);
        console.log(body);
        var result = JSON.parse(body);
        var parsed_result = {};

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
        res.send(parsed_result);
    });
};

exports.request_search = function (req, res) {
    var search_value = req.query.searchVal;

    var search_options = {
        method: "GET",
        url: "http://onemap.duckdns.org/search",
        qs: {
            searchVal: search_value,
            getAddrDetails: "Y",
            returnGeom: "N"
        }
    };

    request(search_options, function(err, response, body) {
        if (err) throw new Error(err);
        console.log(body);
        var result = JSON.parse(data);
        var array_of_features = [];

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
        res.send(array_of_features);
    });
};
