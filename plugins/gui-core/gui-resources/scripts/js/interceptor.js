define([config.cjs('views/auth.js')], function(auth) {
    var interceptor = function($q) {
        return {
            'responseError': function(rejection) {
                if(rejection.status == 401) {
                    auth.renderPopup(_('Please login to continue!'));
                }
                return $q.reject(rejection);
            }
        }
    }
    return interceptor;
});