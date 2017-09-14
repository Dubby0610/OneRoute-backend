'use strict';
var request = require("request");

var toky = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjg2OSwidXNlcl9pZCI6ODY5LCJlbWFpbCI6IkUwMTc2MzA4QHUubnVzLmVkdSIsImZvcmV2ZXIiOmZhbHNlLCJpc3MiOiJodHRwOlwvXC9vbTIuZGZlLm9uZW1hcC5zZ1wvYXBpXC92MlwvdXNlclwvc2Vzc2lvbiIsImlhdCI6MTUwNTM4NTgyOCwiZXhwIjoxNTA1ODE3ODI4LCJuYmYiOjE1MDUzODU4MjgsImp0aSI6ImUyMGM2Y2RkMGUyZTVmNTdlMzk2YjlhNWZiMjA1MTkyIn0.KX1iKgdVW6cY0DuMVyG1Fm1iwUmIIeVGB03Qt1U6Z2U";

exports.draw_path = function(req, res) {
    // read req.body for sp, ep, routeType
    // send to onemap
    // retrieve data
    // return to user

    console.log(req.query);
    var start_point = req.query.start;
    var end_point = req.query.end;
    // route_type must be in lowercase
    var route_type = req.query.routeType;

    var token_options = { method: 'GET',
        url: "https://127.0.0.1/authtoken"
    };

    request(token_options, function(err, response, body) {

        console.log(body);
        var token = response.body.access_token;

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
            console.log(body);
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