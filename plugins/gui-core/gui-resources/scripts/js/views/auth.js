define
([
    'jquery', 'jquery/superdesk', 'gizmo/superdesk', 
    'gizmo/superdesk/action', 'utils/sha512',
    'gizmo/superdesk/models/auth-token',
    'gizmo/superdesk/models/auth-login',
    'jquery/tmpl', 'jquery/rest', 'bootstrap',
    'tmpl!auth', 'tmpl!auth-page' 
],
function($, superdesk, gizmo, Action, jsSHA, AuthToken, AuthLogin)
{
    var 
    /*!
     * performs login
     */
    AuthLoginApp = function(username, password, loginToken)
    {
        var shaUser = new jsSHA(username, "ASCII"),
            shaPassword = new jsSHA(password, "ASCII"),         
            shaStep1 = new jsSHA(shaPassword.getHash("SHA-512", "HEX"), "ASCII"),
            shaStep2 = new jsSHA(loginToken, "ASCII"),          
            authLogin = new $.rest('Security/Authentication/Login').xfilter('User.Name,User.Id,User.EMail'),
            
            HashedToken = shaStep1.getHMAC(username, "ASCII", "SHA-512", "HEX");            
            HashedToken = shaStep2.getHMAC(HashedToken, "ASCII", "SHA-512", "HEX");
            
        authLogin.resetData().insert
        ({
            UserName: username,
            Token: loginToken, 
            HashedToken: HashedToken
        })
        .done(function(data)
        {
            var user = data.User;
            
            // h4xx to set login href.. used in menu to get actions path
            localStorage.setItem('superdesk.login.selfHref', (data.User.href.indexOf('my/') === -1 ? data.User.href.replace('resources/','resources/my/') : data.User.href) );
            // /h4axx
            
            localStorage.setItem('superdesk.login.session', data.Session);
            localStorage.setItem('superdesk.login.id', user.Id);
            localStorage.setItem('superdesk.login.name', user.Name);
            localStorage.setItem('superdesk.login.email', user.EMail);
            $.restAuth.prototype.requestOptions.headers.Authorization = localStorage.getItem('superdesk.login.session');
            
            superdesk.login = {Id: localStorage.getItem('superdesk.login.id'), Name: localStorage.getItem('superdesk.login.name'), EMail: localStorage.getItem('superdesk.login.email')}
            
            $(authLogin).trigger('success');
        });
        return $(authLogin);
    },
    AuthTokenApp = function(username, password) 
    {
        // new token model
        var authToken = new AuthToken,
            self = this;
        authToken.set({ userName: username }).sync()
        .done(function(data)
        {
            // attempt login after we got token
            authLogin = new AuthLogin;
            authLogin.authenticate(username, password, data.Token)
            .done(function(data)
            {
                var user = data.User;
                
                localStorage.setItem('superdesk.login.selfHref', (data.User.href.indexOf('my/') === -1 ? data.User.href.replace('resources/','resources/my/') : data.User.href) );
                
                localStorage.setItem('superdesk.login.session', data.Session);
                localStorage.setItem('superdesk.login.id', user.Id);
                localStorage.setItem('superdesk.login.name', user.Name);
                localStorage.setItem('superdesk.login.email', user.EMail);
                
                $.restAuth.prototype.requestOptions.headers.Authorization = localStorage.getItem('superdesk.login.session');
                
                $.extend(true, Action.actions.syncAdapter.options.headers, {'Authorization': localStorage.getItem('superdesk.login.session')});
                
                superdesk.login = {Id: localStorage.getItem('superdesk.login.id'), Name: localStorage.getItem('superdesk.login.name'), EMail: localStorage.getItem('superdesk.login.email')}
                $(authLogin).trigger('success');
            });
            authLogin.on('failed', function()
            {
                $(self).triggerHandler('failed', 'authToken');
            })
            .on('success', function()
            {
                $(self).triggerHandler('success');
            });
        });
        return self;
    },
    
    AuthApp = gizmo.View.extend
    ({
        success: $.noop,
        showed: false,
        require: function()
        {
            if(AuthApp.showed) return;
            var self = this,
                data = this.loginExpired ? {'expired': true} : {}; // rest
            AuthApp.showed = true;  
            $.tmpl('auth', data, function(e, o)
            { 
                var dialog = $(o).eq(0).dialog
                    ({ 
                        draggable: false,
                        resizable: false,
                        modal: true,
                        width: "40.1709%",
                        buttons: 
                        [
                             { text: "Login", click: function(){ $(form).trigger('submit'); }, class: "btn btn-primary"},
                             { text: "Close", click: function(){ $(this).dialog('close'); }, class: "btn"}
                        ],
                        close: function(){ $(this).remove(); AuthApp.showed = false; }
                    }),
                    form = dialog.find('form');
                
                form.off('submit.superdesk')
                .on('submit.superdesk', function(event)
                {
                    var username = $(this).find('#username'), 
                        password = $(this).find('#password'),
                        alertmsg = $(this).find('.alert');
                    
                    $(AuthTokenApp(username.val(), password.val()))
                        .on('failed', function(evt, type)
                        { 
                            password.val('');
                            username.focus();
                            alertmsg.removeClass('hide');
                            $(self).triggerHandler('login-failed');
                        })
                        .on('success', function(evt)
                        { 
                            AuthApp.success && AuthApp.success(); 
                            $(dialog).dialog('close'); 
                            AuthApp.showed = false; 
                            $(AuthApp).trigger('authenticated');
                            $(self).triggerHandler('login');
                        });
                    event.preventDefault();
                    
                });
                
            });
        },
        events:
        {
            'form': { 'submit': 'login' },
            '.login-popup': { 'submit': 'login' }
        },
        /*!
         * login state
         */
        _loggedIn: false,
        /*!
         * set login if storage item exitsts
         */
        init: function()
        {
            if( localStorage.getItem('superdesk.login.session') )
            {
                this._loggedIn = true;
                // rev compat
                superdesk.login = {Id: localStorage.getItem('superdesk.login.id'), Name: localStorage.getItem('superdesk.login.name'), EMail: localStorage.getItem('superdesk.login.email')}
            }
            
            var self = this;
            $(document).on('submit', '.login-popup', function(evt){ self.login(evt, $('.login-popup')); });
        },
        /*!
         * perform authentication
         */
        login: function(event, el)
        {
            var el = el || this.el,
                username = $(el).find('#username'), 
                password = $(el).find('#password'),
                alertmsg = $(el).find('.alert'),
                self = this;
        
            // make new authentication process
            $(AuthTokenApp(username.val(), password.val())) 
            .on('failed', function(evt, type)
            { 
                password.val('');
                username.focus();
                alertmsg.removeClass('hide');
                self._loggedIn = false;
                $(self).triggerHandler('login-failed');
            })
            .on('success', function(evt)
            { 
                $(this.el).find('.login-popup'),
                $(AuthApp).trigger('authenticated');
                self._loggedIn = true;
                $(self).triggerHandler('login');
            });
            event.preventDefault();
        },
        
        /*!
         * remove authentication
         */
        logout: function()
        {
            localStorage.removeItem('superdesk.login.selfHref');
            localStorage.removeItem('superdesk.login.session');
            localStorage.removeItem('superdesk.login.id');
            localStorage.removeItem('superdesk.login.name');
            localStorage.removeItem('superdesk.login.email');
            
            delete $.restAuth.prototype.requestOptions.headers.Authorization;
            delete Action.actions.syncAdapter.options.headers.Authorization;
            delete superdesk.login;
            
            $(this).triggerHandler('logout');
        },
        
        /*!
         * render the login page
         */
        render: function()
        {
            var self = this;
            if( self._loggedIn ) 
            {
                $(self).triggerHandler('login');
                return true;   
            }
            $.tmpl('auth-page', {}, function(e, o){ self.el.html(o); });
        },
        _dialog: null,
        /*!
         * render and show login dialog
         */
        renderPopup: function()
        {
            var self = this,
                data = this.loginExpired ? {'expired': true} : {}; // rest
            // return if dialog showing
            if( $(this._dialog).is(':visible') ) return;
            // render template
            (!this._dialog || !this._dialog.length) && $.tmpl('auth', data, function(e, o)
            { 
                self._dialog = $(o);
                self._dialog.dialog
                ({ 
                    draggable: false,
                    resizable: false,
                    modal: true,
                    width: "40.1709%",
                    buttons: 
                    [
                         { text: "Login", click: function(){ $(this).find('form:eq(0)').trigger('submit'); }, class: "btn btn-primary"},
                         { text: "Close", click: function(){ $(this).dialog('close'); }, class: "btn"}
                    ]
                });
            });
            this._dialog.length && this._dialog.dialog('open');
        }
    });
    
    return new AuthApp;
});