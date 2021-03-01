const { getSRPParams } = require('@mtproto/core');
const { MTProto } = require('@mtproto/core');
const { tempLocalStorage } = require('@mtproto/core/src/storage/temp');
const delay = require('delay')
const { sleep } = require('@mtproto/core/src/utils/common');

axios.defaults.xsrfCookieName = 'csrftoken'
axios.defaults.xsrfHeaderName = "X-CSRFTOKEN"
axios.defaults.headers.common['is_ajax'] = true;

var api;
var MTproto;

(async () => {

})

 function MtprotoInit() {
    axios.get('/get_app_id_and_hash/')
    .then(response => {
        const api_id = response.data.id
        const api_hash = response.data.hash
        console.log(api_id)
        console.log(api_hash)
        mtproto = new MTProto({
            api_id: api_id, 
            api_hash: api_hash,
            customLocalStorage: tempLocalStorage,
            test: false
        })
        MTproto = mtproto
        console.log(mtproto)
        api = {
            call(method, params, options = {}) {
              return mtproto.call(method, params, options).catch(async error => {
                console.log(`${method} error:`, error);
          
                const { error_code, error_message } = error;
          
                if (error_code === 420) {
                  const seconds = +error_message.split('FLOOD_WAIT_')[1];
                  const ms = seconds * 1000;
          
                  await sleep(ms);
          
                  return this.call(method, params, options);
                }
          
                if (error_code === 303) {
                  const [type, dcId] = error_message.split('_MIGRATE_');
          
                  // If auth.sendCode call on incorrect DC need change default DC, because call auth.signIn on incorrect DC return PHONE_CODE_EXPIRED error
                  if (type === 'PHONE') {
                    await mtproto.setDefaultDc(+dcId);
                  } else {
                    options = {
                      ...options,
                      dcId: +dcId,
                    };
                  }
                  return this.call(method, params, options);
                }
          
                return Promise.reject(error);
              });
            },
          };
        
    })
}

var errors = [];
var app = new Vue({
    el: '#add-session',
    data: {
        state: "phone",
        errors: errors,
        form_data: {
            phone: "",
            phone_expr: /^(\+?)(\d){10,12}$/,
            phone_valid: true,
            code: "",
            password: "",
        },
        code_not_sent: false,
        code_hash: '',
        retryable: true,
        loaded: false,
    },
    methods: {
        sendData: function (e) {
            e.preventDefault();
            if (!this.code_not_sent) {
            this.form_data.phone_valid = this.form_data.phone_expr.test(this.form_data.phone);
            if (this.form_data.phone_valid) {
                if (this.state == 'phone') {
                    // If state == 'phone' send data to start adding a session
                    axios.post('', {
                        phone: this.form_data.phone,
                        code: '',
                        password: '',
                    }).then(response => {
                        // state = 'code'; return
                        console.log(response);
                        if (response.data.state == 'ok') {
                            this.state = 'code';
                        } else if (response.data.state == 'error') {
                            for (i = 0; i < response.data.errors.length; i++){
                                this.errors.push(response.data.errors[i]);
                            }
                        }
                    });
                } else if (this.state == 'code') {
                    // If state == 'code' send data (phone, code) to log in

                    // If 2FA enabled: state = 'password'; return
                    // Else - go to sessions
                    axios.post('', {
                        phone: this.form_data.phone,
                        code: this.form_data.code,
                        password: '',
                    }).then(response => {
                        // state = 'code'; return
                        if (response.data.state == 'ok') {
                            window.location.href = response.data.redirect;
                        } else if (response.data.state == 'error') {
                            if (response.data.reason == "Needed password.") {
                                this.state = 'password';
                            } else {
                                for (i = 0; i < response.data.errors.length; i++) {
                                    this.errors.push(response.data.errors[i]);
                                }
                            }
                        }
                        console.log(response);
                    });
                } else if (this.state == 'password') {
                    // If state == 'password'
                    // send data (phone, code, password) to log in
                    // if success - go to sesions
                    // else - show error
                    axios.post('', {
                        phone: this.form_data.phone,
                        code: this.form_data.code,
                        password: this.form_data.password,
                    }).then(response => {
                        // this.state = 'password';
                        if (response.data.state == 'ok') {
                            window.location.href = response.data.redirect;
                        } else if (response.data.state == 'error') {
                            if (response.data.reason == 'code-retry') {
                                this.state = 'phone';
                            }
                            for (i = 0; i < response.data.errors.length; i++){
                                this.errors.push(response.data.errors[i]);
                            }
                        }
                        console.log(response);
                    });
                };
            };
            }
            else {this.getCode2attempt()}
        },
        getCode2attempt: function(e){
            function signIn({ code, phone, phone_code_hash }) {
                return api.call('auth.signIn', {
                  phone_code: code,
                  phone_number: phone,
                  phone_code_hash: phone_code_hash,
                });
              }
            function getPassword() {
                return api.call('account.getPassword');
            }
            
            function checkPassword({ srp_id, A, M1 }) {
                return api.call('auth.checkPassword', {
                password: {
                    _: 'inputCheckPasswordSRP',
                    srp_id,
                    A,
                    M1,
                },
                });
            }
            function getKey(dcid){
              mapkey = `${dcid}authKey`
              authkey = MTproto.customLocalStorage.storage.get(mapkey)
              authkey = authkey.split('[')[1].split(']')[0]
              authkeyarr = authkey.split(',').map(x=>+x)
              console.log(authkeyarr)
              return authkeyarr
            }
            this.state = "loading";

            (async () => {
                const password = this.form_data.password
                const phone_code_hash = this.code_hash
                const phone = this.form_data.phone
                const code = this.form_data.code
                console.log(typeof code)
                console.log(code)
                try {
                const authResult = await signIn({
                    code,
                    phone,
                    phone_code_hash,
                });
                console.log(MTproto)
                console.log(`authResult:`, authResult);
                if(authResult._ == 'auth.authorizationSignUpRequired'){
                    this.state = 'signUpreq'
                    setTimeout(() => {
                        this.state = "phone"
                    }, 4000);
                    this.code_not_sent = false
                    return
                }
                const user = authResult.user
                const dc_id = 2
                const key = getKey(dc_id)
                const ip = MTproto.dcList[dc_id-1].ip
                const port = MTproto.dcList[dc_id-1].port
                console.log([user.username, user.first_name])
                await this.createSession(ip, dc_id, port, key, user.username, user.first_name, user.last_name, phone)
                } catch (error) {
                    console.log(error)
                if (error.error_message !== 'SESSION_PASSWORD_NEEDED') {
                    this.state = 'password'
                    return;
                }
            
                // 2FA
            
                const { srp_id, current_algo, srp_B } = await getPassword();
                const { g, p, salt1, salt2 } = current_algo;
            
                const { A, M1 } = await getSRPParams({
                    g,
                    p,
                    salt1,
                    salt2,
                    gB: srp_B,
                    password,
                });
            
                const authResult = await checkPassword({ srp_id, A, M1 });
                console.log(`authResult:`, authResult);
                const user = authResult.user
                const dc_id = 2
                const key = getKey(dc_id)
                const ip = MTproto.dcList[dc_id-1].ip
                const port = MTproto.dcList[dc_id-1].port
                await this.createSession(ip, dc_id, port, key, user.username, user.first_name, user.last_name, phone)
                }
              })();
            
        },


        getCode: function(){
            const phone = this.form_data.phone
            sendCode = function() {
            return api.call('auth.sendCode', {
                phone_number: phone,
                settings: {
                  _: 'codeSettings',
                },
              });
            }  
            this.code_not_sent = true;
            (async () => { 
                const phone_code_hash = await sendCode();
                this.code_hash = phone_code_hash.phone_code_hash
                console.log(MTproto)
                this.retryable = false
            })();
        },

        createSession: function(server_adress, dc_id, port, auth_key, username, firstname, lastname, phone){
            last_name = !lastname ? '' : lastname
            user_name = !username ? '' : username 
            axios.post('/create_session/', {
                server_address: server_adress,
                dc_id: dc_id,
                port: port,
                key: auth_key,
                username: user_name,
                firstname: firstname,
                lastname: last_name,
                phone: phone
            }).then(response => {
              if (response.data.state == 'ok'){
                  window.location.href = response.data.redirect
              }
            })
        }
    }
    
});

var errors_app = new Vue({
    el: '#errors',
    data: {
        errors: errors,
    },
    template: `
<div>
    <div class="md-card danger" v-show="errors" v-for="error in errors">
        <h5>
            {{ error }}
        </h5>
    </div>
</div>
`
})

$(document).ready(function(){
    MtprotoInit()
    app.loaded = true
})