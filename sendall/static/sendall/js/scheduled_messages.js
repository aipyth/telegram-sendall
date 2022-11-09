var vue_dialogs = new Vue({
  el: '#scheduled', 
  data: {
    selected_contacts_ids: selected_contacts_ids,
    all_dialogs: all_dialogs,
    current_dialogs: [],
    search_dialogs: '',
    history: {},
    loading: false,
    message: "" ,
    items: [],
    selected: '',
    errorMessage: "",
    errorMessage2: "",
    notification: "",
    time: 0,
  },
  methods: {
    // getDialogs: function() {
    //     if (all_dialogs.length != 0)
    //         return;
    //     this.loading = true;
    //     if (get_dialogs_request_sent) {
    //         axios.post('dialogs/', {
    //                 uuidkey: uuidkey
    //             }).then(response => {
    //                 console.log(response);
    //                 if (response.data.state == 'not_logged') {
    //                     $('#not-logged-modal').modal('show');
    //                     this.loading = false;
    //                     return;
    //                 } else if (response.data.uuidkey) {
    //                     return;
    //                 }
    //                 for (i = 0; i < response.data.dialogs.length; i++) {
    //                     all_dialogs.push(response.data.dialogs[i]);
    //                     this.current_dialogs.push(response.data.dialogs[i]);
    //                 }
    //                 this.loading = false;
    //             });
    //     } else {
    //         axios.get('dialogs/')
    //             .then(response => {
    //                 uuidkey = response.data.uuidkey;
    //             });
    //         get_dialogs_request_sent = true;
    //     }
    // },
    // select_contact: function(dialog) {
    //     index = this.selected_contacts_ids.indexOf(dialog.id)
    //     if (index + 1) {
    //         console.log('unselecting dialog');
    //         this.selected_contacts_ids.splice(index, 1);
    //         for (i = 0; i < selected_contacts_for_list.length; i++) {
    //             if (dialog.id == selected_contacts_for_list[i].id) {
    //                 selected_contacts_for_list.splice(i, 1);
    //             }
    //         }
    //     } else {
    //         console.log('selecting dialog');
    //         this.selected_contacts_ids.push(dialog.id);
    //         selected_contacts_for_list.push(dialog);
    //     }
    // },
    // searchText: function(searchText) {
    //     for (i = 0; i < all_dialogs.length; i++) {
    //         if (all_dialogs[i].name.toLowerCase().includes(searchText.toLowerCase())) {
    //             this.current_dialogs.push(all_dialogs[i]);
    //         }
    //     }
    // },
    // changeContactsIds: function(new_id){
    //     this.selected_contacts_ids = new_id
    // },
    saveText(){
      if (this.items.includes(this.message) || this.message == ""){
        this.errorMessage = "This text alredy exist or empty"
        setTimeout(() => { this.errorMessage = "" }, 3000)
        return 
      }
      console.log(message)
      this.items.push(this.message);
      axios.put('add_deadline_message_text/', { messages: this.items })
        .then((response) => {
          if (response.status == 200) this.notify("New reply message is added")
          console.log(response)
        });


    },
    deleteText (text){
      const index = this.items.indexOf(text)
      this.items.splice(index, 1)
      axios.put('add_deadline_message_text/', { messages: this.items })
        .then((response) => {
          if (response.status == 200) this.notify("Reply message has been deleted")
          console.log(response)
        });
      this.selected = ''
    },

    editText(text) {
      if (this.selected == text) {
        this.selected = ''
        this.message = ''
      } else {
        this.message = text
        this.selected = text
      }
        
    },
    saveEditedText () {
      const index = this.items.indexOf(this.selected)
      this.items.splice(index, 1)
      this.items.push(this.message)
      axios.put('add_deadline_message_text/', { messages: this.items })
        .then((response) => {
          if (response.status == 200) this.notify("Reply message has been edited")
          console.log(response)
        });
    },

    notify(message) {
      this.notification = message
      setTimeout(() => this.notification = '', 3000)
    },

    saveTime() {
      if (this.time <= 0 || isNaN(this.time) ){
        this.errorMessage2 = "Time should be positive number"
        setTimeout(() => { this.errorMessage2 = "" }, 3000)
        return 
      }
      axios.put('add_deadline_message_time/', { deadline_time: this.time })
      .then((response) => { if (response.status == 200) this.notify("Deadline is set")
          console.log(response)})
        .catch((error) => console.log(error))
      
    },


  },
    // watch: {
    // search_dialogs: function(newSearchText, oldSearchText) {
    //     this.current_dialogs.splice(0, this.current_dialogs.length);
    //     this.searchText(newSearchText);
        // if (this.history[newSearchText]) {
        //     this.current_dialogs = this.history[newSearchText];
        // } else {
        //     this.searchText(newSearchText);
        //     this.history[newSearchText] = this.current_dialogs;
        // }
  //   }
    
  // },
  mounted() {
    axios.get('deadline_message_settings/')
      .then((response) => {
        this.items = response.data.messages
        this.time = response.data.deadline_time
      }
      )
      .catch((error) => console.log(error))
      
  },
  
  sendMessage(){
    axios.put('add_deadline_message_text/', this.items)
  },

template: `
<div style='position: relative;'>
  <transition name="show">
    <div class='loading-card' v-if="notification != ''">
        <h5>
            {{ notification }}
        </h5>
    </div>
  </transition>
  <div class="contariner fixed-card card-shadow " style="height: 100%; " >
    <div class="wrapper col d-sm-none d-md-block">
      <div class="blanlk-btn" style=""> 
        <button class="btn btn-lg btn-outline-primary btn-block" target="#chats-contacts" id="collapsing_button">
          Blanks
        </button> 
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
              <div class='col'>
                  <button class='btn btn-block btn-primary but-send' v-on:click="saveText" v-if="selected == '' "> 
                    Save
                    <i class="fa fa-download " style="padding-left: 4px " ></i>
                  </button>
                  <button class='btn btn-block btn-primary but-send' v-on:click="saveEditedText" v-else> 
                    Edit
                    <i class="fa fa-solid fa-pen" style="padding-left: 4px" ></i>
                    </button>
                  <transition name="show" >
                  <div class="no-chats-message" v-if="errorMessage !== ''">
                      <p>{{ errorMessage }}</p>
                  </div>
                  </transition>
              </div>
          </div>
        </div>
          
        <div class="active-tasks d-flex flex-column"">
          <div class="current-tasks collapse show" id="currentTasks">
            <transition-group name="show">
              <div class="contact task" v-for="item in items" :key="item" v-bind:class="{ clicked: selected == item }" v-on:click="editText(item)">
                <div class="row">
                  <div class="col-10 h-25">
                  </div> 
                  <div class="col-2">
                    <button type="button" v-on:click="deleteText(item)" title="Delete this message" class="ml-2 mb-2 close">
                      <span aria-hidden="true">
                        ×  
                      </span>
                    </button>
                  </div>
                  <div class="col-12">
                    <p class="message task-text">{{ item }}</p>   
                  </div>
                </div>
              </div>
            </transition-group>
          </div>
        </div>
      </div>
      <div class="text mt-3 ml-3">
        Add deadline hours:
      </div>
      <div class="col-lg-5 col-sm-0 h-25">
      </div>
        <div class="d-flex align-items-start">
          <div class="input-group col-lg-7 col-sm-12 ">
            <input type="number" class="form-control" aria-describedby="basic-addon2"  v-model="time">
            <div class="input-group-append">
              <button class="btn btn-primary" type="button" id="button-addon1"  v-on:click="saveTime">Send</button>
            </div>
          </div>
          <transition name="show" >
            <div class="no-chats-message" v-if="errorMessage2 !== ''">
              <p class="pt-0" >{{ errorMessage2 }}</p>
            </div>
          </transition>
        </div>
      <div>
      </div>
    </div>
  </div>
</div>
`
});