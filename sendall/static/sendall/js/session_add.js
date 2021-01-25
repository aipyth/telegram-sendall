const { getSRPParams } = require('@mtproto/core');
const { MTProto } = require('@mtproto/core');
const { tempLocalStorage } = require('@mtproto/core/src/storage/temp');
const delay = require('delay')
const { sleep } = require('@mtproto/core/src/utils/common');

axios.defaults.xsrfCookieName = 'csrftoken'
axios.defaults.xsrfHeaderName = "X-CSRFTOKEN"
axios.defaults.headers.common['is_ajax'] = true;

var api 

function MtprotoInit() {
    axios.get('/get_app_id_and_hash/')
    .then(response => {
        const api_id = response.data.id
        const api_hash = response.data.hash
        mtproto = new MTProto({
            api_id: api_id, 
            api_hash: api_hash,
            customLocalStorage: tempLocalStorage,
        })
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
            phone_expr: /^(\+?)(\d){12}$/,
            phone_valid: true,
            code: "",
            password: "",
        },
        code_not_sent: false,
        code_hash: ''
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
            e.preventDefault();
            sendCode = function(phone) {
                return api.call('auth.sendCode', {
                    phone_number: phone,
                    settings: {
                      _: 'codeSettings',
                    },
                  });
                } 

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
            console.log(parseInt("55432", 10))
            this.state = "code";

            (async () => {
                const password = this.form_data.password
                const phone_code_hash = await sendCode(this.form_data.phone);
                const phone = this.form_data.phone
                console.log("delaying, get the code faster!")
                await delay(25000)
                const code = parseInt(this.form_data.code, 10)
                console.log(typeof code)
                try {
                const authResult = await signIn({
                    code,
                    phone,
                    phone_code_hash,
                });
                console.log("aaaaaaaaaaaaaaaa")
                console.log(`authResult:`, authResult);
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
                }
              })();
            
        },


        // getCode: function(){
        //     sendCode = function(phone) {
        //     return api.call('auth.sendCode', {
        //         phone_number: phone,
        //         settings: {
        //           _: 'codeSettings',
        //         },
        //       });
        //     } 
        //     this.code_not_sent = true;
        //     (async () => { 
        //         this.code_hash = await sendCode(this.form_data.phone);
        //         console.log(this.code_hash)
        //     })();
        // }
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
})