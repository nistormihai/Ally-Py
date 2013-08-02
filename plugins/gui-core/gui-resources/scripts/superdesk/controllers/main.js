/*global define*/
'use strict';

/**
 * The main controller for the superdesk. The controller:
 */

define(['superdesk/superdesk'], function (superdesk) {
	
	return superdesk.controller('Main', ['$scope',
		function Main($scope) {
			$scope.menu = 'Some menu';
		}
	]);
});