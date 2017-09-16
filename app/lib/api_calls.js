function routeReq(start, end, mode) {
    var startcoord = start[1] + "," + start[0];
    var endcoord = end[1] + "," + end[0];
    // var startcoord = start;
    // var endcoord = end;
    $.ajax({
        method: "GET",
        url: "http://onemap.duckdns.org/route",
        data: {
            start: startcoord,
            end: endcoord,
            routeType: mode,
        },

        success: function (data, status) {
            var result = JSON.parse(data);
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
            for (var i = 0; i < result["alternativeroute"].length; i++) {
                parsed_result["alternative"][i] = turf.feature(featuregeom(result["alternativeroute"][i]))
            }
            console.log(status);
            console.log(parsed_result);
            return parsed_result;
        }
    });
}

function searchReq(query) {
    $.ajax({
        method: "GET",
        url: "http://onemap.duckdns.org/search",
        data: {
            searchVal: query,
            getAddrDetails: "Y",
            returnGeom: "N"
        },

        success: function (data, status) {
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
            console.log(status);
            console.log(array_of_features);
            return array_of_features;

        }
    });
}