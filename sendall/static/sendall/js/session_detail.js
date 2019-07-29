/////// URL'S PATHS ARE STATIC HERE ////////

axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = "X-CSRFTOKEN";

var selected_contacts = [];

Vue.filter('cutTooLong', function (value) {
    var low_limit = 50;
    var high_limit = 60;
    if (value == null) {
        return;
    }
    if (value.length > low_limit && value.length < high_limit) {
        return value;
    } else if (value.length > low_limit) {
        return value.slice(0, low_limit) + "...";
    } else {
        return value;
    }
});

var vue_dialogs = new Vue({
    el: '#vue-dialogs',
    data: {
        selected_contacts: selected_contacts,
        all_dialogs: [],
        loading: true,
    },
    methods: {
        get_dialogs: function() {
            axios.get('dialogs/')
                .then(response => {
                    console.log(response);
                    for (i = 0; i < response.data.dialogs.length; i++) {
                        this.all_dialogs.push(response.data.dialogs[i]);
                    }
                    this.loading = false;
            });
        },
        select_contact: function(id) {
            index = this.selected_contacts.indexOf(id)
            if (index + 1) {
                console.log('unselecting dialog');
                this.selected_contacts.splice(index, 1);
            } else {
                console.log('selecting dialog');
                this.selected_contacts.push(id);
            }
        }
    },
    template: `
<div class='fixed-card'>
    <button class="btn btn-light btn-block" type="button" data-toggle="collapse" data-target="#chats" aria-expanded="true" aria-controls="chats">Chats</button>
    <div id='chats' class='collapse show'>
        <div align='center' v-if="loading">
            <h3>
                <div class="spinner-grow text-primary" role="status">
                    <span class="sr-only"></span>
                </div> 
            </h3>
        </div>
        <div class="contact" v-for="dialog in all_dialogs" v-on:click="select_contact(dialog.id)" v-bind:class="{selected: selected_contacts.includes(dialog.id)}">
            <h4>
                {{ dialog.name }}
                <span class="badge badge-pill badge-primary" v-if="dialog.unread != 0">
                    {{ dialog.unread }}
                </span>
            </h4>
            <p class="text-muted">{{ dialog.message | cutTooLong }}</p>
        </div>
    </div>
</div>
`
});
vue_dialogs.get_dialogs();


var vue_messages = new Vue({
    el: "#vue-message",
    data: {
        selected_contacts: selected_contacts,
        message: '',
        markdown: true,
        requesting: false,
        request_result: '',
        errors: [],
    },
    methods: {
        sendMessage: function() {
            console.log("Selected contacts " + selected_contacts);
            this.requesting = true;
            axios.post('sendmessage/', {
                contacts: selected_contacts,
                message: this.message,
                markdown: this.markdown,
            }).then(response => {
                this.requesting = false;
                this.request_result = '';
                console.log(response);
                if (response.data.state == 'ok') {
                    this.request_result = 'All sent!';
                } else if (response.status == 403) {
                    this.errors.push('You cannot send this');
                }
            });
        },
    },
    template: `
<div>
    <div class='loading-card' v-if="requesting">
        <h3>
            <div class="spinner-grow text-primary" role="status">
                <span class="sr-only"></span>
            </div>
            Sending...
        </h3>
    </div>
    <div class='loading-card' v-if="request_result != ''">
        <h4>
            {{ request_result }}
        </h4>
    </div>
    <div class="md-card danger" v-show="errors" v-for="error in errors">
        <h5>
            {{ error }} 
        </h5>
    </div>
    
    <div class="fixed-card">
        <div class='row'>
        <div class='col'>
            <button class="btn btn-light btn-block" type="button" data-toggle="collapse" data-target="#message" aria-expanded="true" aria-controls="message">Message</button>
        </div>
        </div>
        <div id='message' class='collapse show'>
            <div class="row">
                <div class='col form-group shadow-textarea'>
                    <textarea class='form-control z-depth-1' rows=10 placeholder="Write something here..." v-model="message">
                    </textarea>
                </div>
            </div>
            <div class='row'>
                <div class='col form-group custom-control custom-checkbox'>
                    <input class='custom-control-input' id='markdown' type='checkbox' v-model="markdown">
                    <label class='custom-control-label' for='markdown'>Markdown</label>
                </div>
            </div>

            <div class='row'>
                <div class='col'>
                    <button class='btn btn-block btn-primary' v-on:click="sendMessage">Send</button>
                </div>
            </div>
        </div>
    </div>
</div>
`,
})