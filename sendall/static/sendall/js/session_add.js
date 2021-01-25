const { getSRPParams } = require('@mtproto/core');
const { MTProto } = require('@mtproto/core');
const { tempLocalStorage } = require('@mtproto/core/src/storage/temp');

axios.defaults.xsrfCookieName = 'csrftoken'
axios.defaults.xsrfHeaderName = "X-CSRFTOKEN"
axios.defaults.headers.common['is_ajax'] = true;

var api 

function MtprotoInit() {
    axios.get('/get_app_id_and_hash/')
    .then(response => {
        const api_id = response.data.id
        const api_hash = response.data.hash
        api = new MTProto({
            api_id: api_id, 
            api_hash: api_hash,
            customLocalStorage: tempLocalStorage,
            test: true
        })
        console.log(api)
        api.updateInitConnectionParams({
            app_version: '10.0.0',
          })
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
        getCode2attempt: function(){

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

            (async () => {
                const code = this.form_data.code
                const password = this.form_data.password
                const phone_code_hash = this.code_hash
                const phone = this.form_data.phone
                console.log("try-catch statement")
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


        getCode: function(){
            sendCode = function(phone) {
            return api.call('auth.sendCode', {
                phone_number: phone,
                settings: {
                  _: 'codeSettings',
                },
              });
            } 
            console.log(this.form_data.phone)
            this.code_not_sent = true;
            (async () => { 
                this.code_hash = await sendCode(this.form_data.phone);
                console.log(this.code_hash)
            })();
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
})