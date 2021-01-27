/////// URL'S PATHS ARE STATIC HERE ////////

axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = "X-CSRFTOKEN";

var selected_contacts_ids = []; // list for sending message
var selected_contacts_for_list = []; // list for creating new contacts list
var all_dialogs = []; // list where all dialogs are donwloaded
var uuidkey = '';
var get_dialogs_request_sent = false;
var opened = false

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
        },
        changeContactsIds: function(new_id){
            this.selected_contacts_ids = new_id
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
<div class="chats-block">
    <form class="form" style="margin-bottom: 15px;">
        <input class="form-control search" type="search" placeholder="Search" aria-label="Search" v-model="search_dialogs">
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
    <div id='prepared-contacts-list' class="contacts-block">
        <div align='center' v-if="loading">
            <h3>
                <div class="spinner-grow text-primary" role="status">
                    <span class="sr-only"></span>
                </div> 
            </h3>
        </div>
        <button class='btn btn-light btn-block' v-on:click="enterNewListName" v-show="!entering_new_list_name" id="createlist">Create new list from selected contacts</button>
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
`,
});
vue_contacts_lists.getLists();

var vue_messages = new Vue({
    el: "#vue-message",
    data: {
        message: '',
        markdown: true,
        time_to_execute: '',
        requesting: false,
        request_result: '',
        request_edit_result: '',
        errors: [],
        markdown_help: false,
        activeTasks: [],
        completedTasks: [],
        selected: {},
        isEditing: false,
        all_dialogs: all_dialogs,
        check_completes: true,
        completed_page: 1,
        right: true,
        not_selected_chats: false,
    },
    watch: {
        all_dialogs: function(oldd, newd){
            vue_messages.getActiveTasks()
        }
    },

    methods: {

        stopRequesting: function(){
            setTimeout(() => {
                this.request_result = ''
                this.getActiveTasks()
            }, 3000);
            setTimeout(() => {
                this.getActiveTasks()
            }, 20000);
        },

        stopRequesting_edit: function(){
            setTimeout(() => {
                this.request_edit_result = ''
                this.getActiveTasks()
                this.isEditing = false
            }, 3000);
            setTimeout(() => {
                this.getActiveTasks()
            }, 20000);
        },

        sendMessage: function() {
            console.log("Selected contacts " + selected_contacts_ids);
            if (selected_contacts_ids.length != 0){
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
                        this.message = ''
                        this.time_to_execute = ''
                        selected_contacts_ids = []
                        this.stopRequesting()
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
            }
            else{
                this.not_selected_chats = true
                setTimeout(() => {
                    this.not_selected_chats = false
                }, 2000);
            }

        },

        this_task_contact_names: function(contacts) {
            selected_contacts = []
            for (dialog of all_dialogs){
                if (contacts.includes(dialog.id)){
                    selected_contacts.push(dialog.name)
                }
            }
            names = ''
            for (let i of selected_contacts){
                names = names + i + ', '
            }
            return names.slice(0, -2)
        },

        GetFormattedDate: function(thisTime) {
            time = new Date(thisTime)
            var month = time.getMonth() + 1
            if(month < 10){
                nul = '0'
            }
            else {nul = ''}
            var day = time.getDate()
            var year = time.getFullYear()
            var hours = time.getHours()
            if (hours > 12){
                hours = hours - 12
                am_pm = 'PM'
            }
            else {
                am_pm = 'AM'
            }
            var minutes = time.getMinutes()
            nuld = day < 10 ? '0' : ''
            nulh = hours < 10 ? '0' : ''
            nulm = minutes < 10 ? '0' : ''
            return nul + month + "/" + nuld + day + "/" + year + ' ' + nulh+ hours + ':' + nulm + minutes + ' ' + am_pm;
            },
       
        getActiveTasks: function() {
            // if (all_dialogs.length != 0){
                axios.post('tasks/', {
                    page: 1,
                    done: false
                }).then(response => {
                    console.log(response)
                    const tasks = response.data.tasks

                    let displayed_tasks = []
                    for (let item of tasks){
                        taskich = {
                            contacts: item.contacts, 
                            time: this.GetFormattedDate(item.eta),
                            message: item.message,
                            markdown: item.markdown,
                            session: item.session,
                            uuid: item.uuid
                            }
                        displayed_tasks.push(taskich)
                        }
                    this.activeTasks = displayed_tasks
                })
            
        },


        getCompletedTasks: function() {
            // if (all_dialogs.length != 0){
                axios.post('tasks/', {
                    uuidkey: uuidkey,
                    page: this.completed_page,
                    done: true
                }).then(response => {
                    console.log(response)
                    const tasks = response.data.tasks
                    let completed_tasks = []
                    for (let item of tasks){
                        taskich = {
                            contacts: item.contacts, 
                            time: this.GetFormattedDate(item.eta),
                            message: item.message,
                            markdown: item.markdown,
                            session: item.session,
                            uuid: item.uuid
                            }
                        completed_tasks.push(taskich)
                        }
                    this.completedTasks = completed_tasks
                })
            // }
            // else {
            //     console.log("Contacts isn't loaded yet")
            // }
        },

        getNextTasks: function (isnext) {
            this.right = isnext
            var has_next = false
            var pagesCount = 0
            console.log(this.completed_page)
            axios.post('tasks/', {
                uuidkey: uuidkey,
                page: this.completed_page,
                done: true
            }).then(response => {
                console.log(response)
                has_next = response.data.has_next_page
                pagesCount = response.data.num_pages
                if (isnext){
                    this.completed_page = has_next ? this.completed_page + 1 : 1
                }
                else {
                    this.completed_page = this.completed_page == 1 ? pagesCount : this.completed_page - 1
                }
                this.getCompletedTasks()
                setTimeout(() => {
                    document.getElementById('completes-modal-title').scrollIntoView({behavior: "smooth"})
                }, 150);
            })
        },

        deleteTask: function(task) {
          axios.delete('tasks/', {
              data:{
              uuid: task.uuid
              } 
          }).then(response => {
              if(response.status == 200)
              {
              id = this.activeTasks.indexOf(task)
              this.activeTasks.splice(id, 1)
              this.stopRequesting_edit()
              }
          })
        },

        editTask: function(task){
            if (task != this.selected){
            if(!opened){
                open()
            }
            this.isEditing = true
            this.selected = task
            this.message = task.message
            this.markdown = task.markdown
            this.time_to_execute = task.time
            selected_contacts_ids = task.contacts
            vue_dialogs.changeContactsIds(task.contacts)
            }
            else {
                this.isEditing = false
                this.selected = {}
                this.message = ''
                this.markdown = true
                this.time_to_execute = ''
                vue_dialogs.changeContactsIds([])
            }
        },
        editMessage: function(){
            this.requesting = true
            if (this.$refs.exec_datetime.value) {
                exec_datetime = new Date(this.$refs.exec_datetime.value);
            } else {
                exec_datetime = new Date();
            }
            axios.put('tasks/', {
                uuid: this.selected.uuid,
                session: this.selected.session,
                contacts: selected_contacts_ids,
                message: this.message,
                markdown: this.markdown,
                eta: exec_datetime.toISOString(),
            }).then(response => {
                this.requesting = false
                this.request_edit_result = response.status == 200 ? "The message is edited" : "Error editing message"
                this.request_result = 'The messages are being sent';
                this.message = ''
                this.time_to_execute = ''
                selected_contacts_ids = []
                this.stopRequesting_edit()
            })
        }
    },

    computed: {
        direction: function(){
            if(this.right) return 'show_horiz_right'
            else if(!this.right) return 'show_horiz_left'
        }
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
    <transition name="show">
    <div class='loading-card' v-if="request_result != ''">
        <h5>
            {{ request_result }}
        </h5>
    </div>
    </transition>
    <transition name="show"
    <div class='loading-card' v-if="request_edit_result != '' ">
        <h5>
            {{ request_edit_result }}
        </h5>
    </div>
    </transition>
    <div class="md-card danger" v-show="errors" v-for="error in errors">
        <h5>
            {{ error }} 
        </h5>
    </div>
    
    <div class="fixed-card card-shadow">
        <div class='row'>
        <div class='col'>
            <button class="btn btn-lg btn-outline-primary btn-block" target="#message" id="collapsing_button">Message</button>
        </div>
        </div>
        <div id='message' class='collapse d-flex flex-column flex-sm-row'>
            <div class="message-input">
            <div class="row">
                <div class='col form-group shadow-textarea'>
                    <textarea class='form-control z-depth-1' rows=10 placeholder="Write something here..." v-model="message">
                    {{ message }}
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
                            <input ref="exec_datetime" type="datetime" class="form-control datetimepicker-input" placeholder="Schedule a message to send" v-model="time_to_execute" data-target="#exec-datetime"/>
                            <div class="input-group-append" data-target="#exec-datetime" data-toggle="datetimepicker">
                                <div class="input-group-text"><i class="fa fa-calendar"></i></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class='row'>
                <div class='col'>
                    <button v-if="!isEditing" class='btn btn-block btn-primary but-send' v-on:click="sendMessage">Send</button>
                    <button v-else class='btn btn-block btn-primary but-send' v-on:click="editMessage">Edit</button>
                    <div class="no-chats-message" v-if="not_selected_chats">
                        <p>You need to select chats before sending message.</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="active-tasks d-flex flex-column"">
            <button class="btn btn-light btn-block" type="button" data-toggle="collapse" data-target="#currentTasks" aria-expanded="true" aria-controls="currentTasks" v-on:click="getActiveTasks()" >Active tasks list</button>
            <div class="current-tasks collapse show" id="currentTasks">
                <transition-group name="show">
                <div class="contact task" v-for="task in activeTasks" :key="task.uuid" v-bind:class="{ clicked: selected == task }" v-on:click="editTask(task)">
                    <div class="row">
                        <div class="col-10 h-25">
                            <h6>To {{ this_task_contact_names(task.contacts) }}</h6>
                        </div> 
                        <div class="col-2"><button type="button" v-on:click="deleteTask(task)" title="Delete this task" class="ml-2 mb-2 close"><span aria-hidden="true">×</span></button></div>
                            <div class="col-12">
                                <p class="message task-text">{{ task.message }}</p>
                                <p class="time message" style="">at {{ task.time }}</p>
                            </div>
                        </div>
                    </div>
                </div>
                </transition-group>
                <button class="btn btn-light btn-block" type="button" data-toggle="modal" data-target="#completes-modal" v-on:click="getCompletedTasks()" >Completed tasks list</button>
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

    <div class="modal fade" id="completes-modal" role="dialog" aria-labelledby="completes-modal-title" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
        <div class="modal-header">
            <h5 class="modal-title" id="completes-modal-title">The list of all completed tasks</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">&times;</span>
            </button>
        </div>
        <div class="modal-body">
        <transition-group v-bind:name="direction" mode="out-in" tag="div">
        <div v-for="task in completedTasks" :key="task.uuid">
            <div class="contact task">
                <div class="row">
                    <div class="col-12 h-25">
                            <h6>To {{ this_task_contact_names(task.contacts) }}</h6>
                    </div> 
                    <div class="col-12">
                        <p class="message">{{ task.message }}</p>
                        <p class="time message" style="">at {{ task.time }}</p>
                    </div>
                    </div>
                </div>
            </div>
            </transition-group>
                <div class="buttons d-flex flex-row justify-content-between">
                    <button class="btn btn-light btn-block w-25" type="button" v-on:click="getNextTasks(false)" >Prev</button>
                    <button class="btn btn-light btn-block w-25" type="button" v-on:click="getNextTasks(true)" >Next</button>
                </div>
            </div>
        </div>
        </div>
    </div>
</div>
    
</div>
`,
});



function open() {
    if (opened) {
        $(".chats-block").removeClass("chats-open")
        $(".contacts-block").removeClass("contacts-open")
        $("#createlist").css("display", "block")
        $(".list-name").css("display", "none")
    }
    else {
        $(".chats-block").addClass("chats-open")
        $(".contacts-block").addClass("contacts-open")
    }

    opened = !opened
}

$("#chat-hideshow").on('click', open)
$("#createlist").on('click', function () {
    if (!opened) 
    {
        open()
        $("#createlist").css("display", "none")
        $(".list-name").css("display", "flex")
    }
    else{

        $("#createlist").css("display", "none")
        $(".list-name").css("display", "flex")
    }
})

$(document).on("click", "#collapsing_button", function(ev){
    elem = $(this).attr('target')
        if($(elem).hasClass('hidden')){
            $(elem).removeClass('hidden')
        }
        else{
            $(elem).addClass('hidden')
        }
})



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
        vue_messages.getActiveTasks()
    });