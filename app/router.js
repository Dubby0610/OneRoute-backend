'use strict';

module.exports = function(app) {
    var onemap = require('./onemap/omController');
    var onemap_auth = require('./onemap_auth/authController');
    var api = require('./lib/one_code');

    // One Map Routes
    app.route('/onemap/authtoken')
        .get(onemap_auth.get_new_token);

    app.route('/onemap/search')
        .get(onemap.get_coords);

    app.route('/onemap/route')
        .get(onemap.draw_path);

    // API Routes
    app.route('/api/route')
        .get(api.get_features);

};
