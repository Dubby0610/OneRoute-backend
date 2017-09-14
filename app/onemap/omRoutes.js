'use strict';

module.exports = function(app) {
    var onemap = require('../onemap/omController');
    var onemap_auth = require('../onemap_auth/authController');

    // One Map Routes
    app.route('/authtoken')
        .get(onemap_auth.get_new_token);

    app.route('/search')
        .post(onemap.get_coords);

    app.route('/route')
        .post(onemap.draw_path);

};