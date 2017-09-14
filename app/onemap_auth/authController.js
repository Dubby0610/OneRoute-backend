'use strict';
var request = require("request"),
    mongoose = require("mongoose"),
    Token = mongoose.model("Token");

var USER_ID = process.env.USER_ID;
var USER_PASS = process.env.USER_PASS;

exports.get_new_token = function(req, res) {
    // post req to onemap using prespecified email and pass
    // retrieve token
    // return to user

    var options = { method: 'POST',
        url: 'https://developers.onemap.sg/privateapi/auth/post/getToken',
        headers:
            { 'cache-control': 'no-cache',
                'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW' },
        formData: { email: USER_ID , password: USER_PASS } };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);

        var parsedBody = JSON.parse(body);
        var new_token = new Token(parsedBody);
        new_token.save(function(err, token) {
            console.log(token);
            if (err)
            res.send(err);
            res.send(token);
        });
    });
};



