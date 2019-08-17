/////// URL'S PATHS ARE STATIC HERE ////////

axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = "X-CSRFTOKEN";

var selected_contacts_ids = []; // list for sending message
var selected_contacts_for_list = []; // list for creating new contacts list
var all_dialogs = []; // list where all dialogs are donwloaded
var uuidkey = '';
var get_dialogs_request_sent = false;

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
        selected_contacts_ids: selected_contacts_ids,
        all_dialogs: all_dialogs,
        current_dialogs: [],
        search_dialogs: '',
        history: {},
        loading: false,
    },
    methods: {
        getDialogs: function() {
            if (all_dialogs.length != 0)
                return;
            this.loading = true;
            if (get_dialogs_request_sent) {
                console.log('uuid key before request: ' + uuidkey)
                axios.post('dialogs/', {
                        uuidkey: uuidkey
                    }).then(response => {
                        console.log(response);
                        if (response.data.state == 'not_logged') {
                            $('#not-logged-modal').modal('show');
                            this.loading = false;
                            return;
                        } else if (response.data.uuidkey) {
                            return;
                        }
                        for (i = 0; i < response.data.dialogs.length; i++) {
                            all_dialogs.push(response.data.dialogs[i]);
                            this.current_dialogs.push(response.data.dialogs[i]);
                        }
                        this.loading = false;
                    });
            } else {
                axios.get('dialogs/')
                    .then(response => {
                        uuidkey = response.data.uuidkey;
                    });
                get_dialogs_request_sent = true;
            }
        },
        select_contact: function(dialog) {
            index = this.selected_contacts_ids.indexOf(dialog.id)
            if (index + 1) {
                console.log('unselecting dialog');
                this.selected_contacts_ids.splice(index, 1);
                for (i = 0; i < selected_contacts_for_list.length; i++) {
                    if (dialog.id == selected_contacts_for_list[i].id) {
                        selected_contacts_for_list.splice(i, 1);
                    }
                }
            } else {
                console.log('selecting dialog');
                this.selected_contacts_ids.push(dialog.id);
                selected_contacts_for_list.push(dialog);
            }
        },
        searchText: function(searchText) {
            for (i = 0; i < all_dialogs.length; i++) {
                if (all_dialogs[i].name.toLowerCase().includes(searchText.toLowerCase())) {
                    this.current_dialogs.push(all_dialogs[i]);
                }
            }
        }
    },
    watch: {
        search_dialogs: function(newSearchText, oldSearchText) {
            this.current_dialogs.splice(0, this.current_dialogs.length);
            this.searchText(newSearchText);
            // if (this.history[newSearchText]) {
            //     this.current_dialogs = this.history[newSearchText];
            // } else {
            //     this.searchText(newSearchText);
            //     this.history[newSearchText] = this.current_dialogs;
            // }
        }
    },
    template: `
<div class='fixed-card card-shadow'>
    <button class="btn btn-lg btn-outline-primary btn-block" type="button" data-toggle="collapse" data-target="#chats" aria-expanded="true" aria-controls="chats">Chats</button>
    <form class="form" style="margin-bottom: 15px;">
        <input class="form-control" type="search" placeholder="Search" aria-label="Search" v-model="search_dialogs">
    </form>
    <div id='chats' class='sm-card collapse show'>
        <div align='center' v-if="loading">
            <h3>
                <div class="spinner-grow text-primary" role="status">
                    <span class="sr-only"></span>
                </div> 
            </h3>
        </div>
        <div class="contact" v-for="dialog in current_dialogs" v-on:click="select_contact(dialog)" v-bind:class="{selected: selected_contacts_ids.includes(dialog.id)}">
            <h5>
                {{ dialog.name }}
                <span class="badge badge-pill badge-primary" v-if="dialog.unread != 0">
                    {{ dialog.unread }}
                </span>
            </h5>
            <p class="message">{{ dialog.message | cutTooLong }}</p>
        </div>
    </div>
</div>
`
});
window.setInterval(vue_dialogs.getDialogs, 2000);


var vue_messages = new Vue({
    el: "#vue-message",
    data: {
        message: '',
        markdown: true,
        requesting: false,
        request_result: '',
        errors: [],
        markdown_help: false,
    },
    methods: {
        sendMessage: function() {
            console.log("Selected contacts " + selected_contacts_ids);
            this.requesting = true;
            this.request_result = '';
            this.errors = [];
            if (this.$refs.exec_datetime.value) {
                exec_datetime = new Date(this.$refs.exec_datetime.value);
            } else {
                exec_datetime = new Date();
            }
            axios.post('send-message/', {
                contacts: selected_contacts_ids,
                message: this.message,
                markdown: this.markdown,
                datetime: exec_datetime.toISOString(),
            }).then(response => {
                // // add contacts list to prepared
                // this.sendContactList();
                // and handle the response
                console.log(response);
                this.requesting = false;
                this.request_result = '';

                if (response.data.state == 'ok') {
                    this.request_result = 'The messages are being sent';
                } else if (response.state == 'error') {
                    for (i = 0; i < response.data.errors; i++) {
                        this.errors.push(response.data.errors[i]);
                    }
                } else if (response.status == 403) {
                    this.errors.push('You cannot send this');
                } else if (response.status == 404) {
                    this.errors.push('Forbidden');
                }
            });
        },
    },
    template: `
<div style='position: relative;'>
    <div class='loading-card' v-if="requesting">
        <h3>
            <div class="spinner-grow text-primary" role="status">
                <span class="sr-only"></span>
            </div>
            Sending...
        </h3>
    </div>
    <div class='loading-card' v-if="request_result != ''">
        <h5>
            {{ request_result }}
        </h5>
    </div>
    <div class="md-card danger" v-show="errors" v-for="error in errors">
        <h5>
            {{ error }} 
        </h5>
    </div>
    
    <div class="fixed-card card-shadow">
        <div class='row'>
        <div class='col'>
            <button class="btn btn-lg btn-outline-primary btn-block" type="button" data-toggle="collapse" data-target="#message" aria-expanded="true" aria-controls="message">Message</button>
            
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
                    <span class='help-popup-icon' data-toggle="modal" data-target="#markdown-modal">?</span>
                    
                </div>
            </div>
            <div class='row'>
                <div class="col">
                    <div class="form-group">
                        <div class="input-group date" id="exec-datetime" data-target-input="nearest">
                            <input ref="exec_datetime" type="text" class="form-control datetimepicker-input" placeholder="Schedule a message to send" data-target="#exec-datetime"/>

                            <div class="input-group-append" data-target="#exec-datetime" data-toggle="datetimepicker">
                                <div class="input-group-text"><i class="fa fa-calendar"></i></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class='row'>
                <div class='col'>
                    <button class='btn btn-block btn-primary' v-on:click="sendMessage">Send</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="markdown-modal" tabindex="-1" role="dialog" aria-labelledby="markdown-modal-title" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="markdown-modal-title">You can format your code with Markdown syntax</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <table class='table'>
                    <tbody>
                        <tr>
                            <td><p>**bold text**</p></td>
                            <td><strong>bold text</strong></td>
                        </tr>
                        <tr>
                            <td><p>__italic text__</p></td>
                            <td><em>italic text</em></td>
                        </tr>

                        <tr>
                            <td><p>\`inline fixed-width code\`</p></td>
                            <td><pre>inline fixed-width code</pre></td>
                        </tr>
                        <tr>
                            <td><p>[Google.com link](https://google.com)</p></td>
                            <td><a href="https://google.com">Google.com link</a></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            </div>
        </div>
    </div>
</div>
`,
});


var vue_contacts_lists = new Vue({
    el: '#vue-contacts-list',
    data: {
        loading: false,
        lists: [],
        selected_list: null,
        entering_new_list_name: false,
        new_list_name: '',
        show_names: false,
    },
    methods: {
        getLists: function() {
            console.log('Updating list of contacts lists');
            this.loading = true;
            axios.get('get-contacts-lists/')
                .then(response => {
                    var idx;
                    console.log(response);
                    for (i = 0; i < response.data.lists.length; i++) {
                        response.data.lists[i].show_names = false;
                        idx = this.lists.push(response.data.lists[i]);
                    }
                    this.loading = false;
            });
        },
        isSelected: function(item) {
            if (this.selected_list == null)
                return false
            if (item.strlist == this.selected_list.strlist)
                return true;
            return false;
        },
        prepareNames: function(obj) {
            var names_list = [];
            for (i = 0; i < obj.length; i++)
                names_list.push(obj[i].name);
            return names_list.join(', ')
        },
        selectList: function(list) {
            // if no selection was before - select this list
            if (this.selected_list == null) {
                this.selected_list = list;
                // push selected ids into the list
                for (i = 0; i < list.list.length; i++) {
                    if (!selected_contacts_ids.includes(list.list[i].id))
                        selected_contacts_ids.push(list.list[i].id);
                }
            }
            // if this list is already selected - unselect
            else if (list.strlist == this.selected_list.strlist) {
                this.selected_list = null;
                // if the unselected ids are in list - get em out
                for (i = 0; i < list.list.length; i++) {
                    if (selected_contacts_ids.includes(list.list[i].id)) {
                        var index = selected_contacts_ids.indexOf(list.list[i].id);
                        selected_contacts_ids.splice(index, 1);
                    }
                    for (n = 0; n < selected_contacts_for_list.length; n++) {
                        if (list.list[i].id == selected_contacts_for_list[n].id) {
                            selected_contacts_for_list.splice(n, 1);
                        }
                    }
                }
            }
            // else - this list is new
            else {
                this.selected_list = list;
                // push new ids to the empty list
                selected_contacts_ids.splice(0, selected_contacts_ids.length);
                for (i = 0; i < list.list.length; i++) {
                    if (!selected_contacts_ids.includes(list.list[i].id)) {
                        selected_contacts_ids.push(list.list[i].id);

                        for (j = 0; j < all_dialogs.length; j++) {
                            if (all_dialogs[j].id == list.list[i].id)
                                selected_contacts_for_list.push(all_dialogs[j]);
                        }
                    }
                }
            }
        },
        enterNewListName: function() {
            this.entering_new_list_name = true;
        },
        createContactsList: function() {
            axios.post('add-contacts-list/', {
                'name': this.new_list_name,
                'list': selected_contacts_for_list,
            }).then(() => {
                this.new_list_name = '';
                this.entering_new_list_name = false;
                this.lists.splice(0, this.lists.length);
                this.getLists();
            });
        },
        editContactsList: function(list) {
            axios.post('edit-contacts-list/', {
                'name': list.name,
                'added': selected_contacts_for_list,
                'list': list.list
            }).then((response) => {
                if (response.data.state == 'ok') {
                    this.lists.splice(0, this.lists.length);
                    this.getLists();
                }
            });
        },
        deleteContactsList: function(list) {
            axios.post('delete-contacts-list/', {
                'strlist': list.strlist,
            }).then((response) => {
                if (response.data.state == 'ok') {
                    this.lists.splice(0, this.lists.length);
                    this.getLists();
                }
            });
        },
    },
    template: `
<div class='fixed-card card-shadow'>
    <button class="btn btn-lg btn-outline-primary btn-block" type="button" data-toggle="collapse" data-target="#prepared-contacts-list" aria-expanded="true" aria-controls="prepared-contacts-list">Prepared Contacts List</button>
    <div id='prepared-contacts-list' class='sm-card collapse show'>
        <div align='center' v-if="loading">
            <h3>
                <div class="spinner-grow text-primary" role="status">
                    <span class="sr-only"></span>
                </div> 
            </h3>
        </div>
        <button class='btn btn-light btn-block' v-on:click="enterNewListName" v-show="!entering_new_list_name">Create new list from selected contacts</button>
        <div class="list-name input-group mb-3" v-show="entering_new_list_name">
            <input type="text" class="form-control" placeholder="Contact List Name" aria-describedby="name-ok" v-model="new_list_name">
            <div class="input-group-append">
                <button class="btn btn-dark" type="button" id="name-ok" v-on:click="createContactsList">OK</button>
            </div>
        </div>

        <div class="contact" v-for="list in lists" v-on:click="selectList(list)" v-bind:class="{selected: isSelected(list)}">
            <div class='row'>
                <div class='col-8 col-md-6'>
                    <h4>
                        {{ list.name }}
                    </h4>
                    
                </div>
                <div class='col-4 col-md-6'>
                    <button type="button" class="ml-2 mb-1 close"  v-on:click.capture.stop="deleteContactsList(list)" title='Delete this list'>
                    <span aria-hidden="true">&times;</span>
                    </button>
                    <button type="button" class="ml-2 mb-1 close"  v-on:click.capture.stop="list.show_names = !list.show_names" title="Show list's dialogs">
                        <span aria-hidden="true">...</span>
                    </button>
                    <button type="button" class="ml-2 mb-1 close"  v-on:click.capture.stop="editContactsList(list)" title='Add selected dialogs to this list'>
                        <span aria-hidden="true">+</span>
                    </button>
                    
                </div>
            </div>
            <div class='row'>
                <div class='col'>
                <p class="message" v-show="list.show_names">{{ prepareNames(list.list) }}</p>
                </div>
            </div>
        </div>
    </div>
</div>
`,
});
vue_contacts_lists.getLists();


// Date and time picker initialize
$(function () {
    $('#exec-datetime').datetimepicker({
        icons: {
            time: 'far fa-clock',
            date: 'far fa-calendar-alt',
            up: 'fas fa-arrow-up',
            down: 'fas fa-arrow-down',
            previous: 'fas fa-chevron-left',
            next: 'fas fa-chevron-right',
            today: 'far fa-calendar-check',
            clear: 'far fa-trash-alt',
            close: 'fas fa-times'
        }
    });
});