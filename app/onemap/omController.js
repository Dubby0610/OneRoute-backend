'use strict';
var request = require("request");

exports.draw_path = function(req, res) {
    // read req for sp (lat,lng), ep (lat,lng), routeType(cycle)

//  console.log(req.query);
    var start_point = req.query.start;
    var end_point = req.query.end;
    // route_type must be in lowercase
    var route_type = req.query.routeType;

    var token_options = { method: 'GET',
        url: "http://onemap.duckdns.org/onemap/authtoken"
    };

    request(token_options, function(err, response, body) {

        if (err) throw new Error(err);
	    console.log(body);
        var parsed_list = JSON.parse(body);
        var token = parsed_list['access_token'];

        var options = {
            method: 'GET',
            url: 'https://developers.onemap.sg/privateapi/routingsvc/route',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            qs: {start: start_point, end: end_point, routeType: route_type, token: token}
        };

        request(options, function (error, response, body) {
            if (error) throw new Error(error);
//          console.log(body);
            res.send(body);
        });
    });
};

exports.get_coords = function(req,res) {
    // read req for search address (text), returngeom(Y/N), getaddrdetails(Y/N)

    console.log(req.query);
    var search_value = req.query.searchVal;
    var return_geom = req.query.returnGeom;
    var get_address = req.query.getAddrDetails;

    var options = { method: 'GET',
        url: 'https://developers.onemap.sg/commonapi/search',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded' },
        qs : { searchVal: search_value, returnGeom: return_geom, getAddrDetails: get_address} };

    request(options, function(error, response, body) {
        if (error) throw new Error(error);
        console.log(body);
        res.send(body);
    });
};
