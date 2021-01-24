import MTProto from 'telegram-mtproto'

axios.defaults.xsrfCookieName = 'csrftoken'
axios.defaults.xsrfHeaderName = "X-CSRFTOKEN"
axios.defaults.headers.common['is_ajax'] = true;

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
            password: ""
        },
    },
    methods: {
        sendData: function (e) {
            e.preventDefault();

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
        },
    },
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