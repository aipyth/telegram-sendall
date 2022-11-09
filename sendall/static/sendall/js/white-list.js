var selected_contacts_ids = []; // list for sending message
var all_dialogs = []; // list where all dialogs are donwloaded
var uuidkey = '';
var get_dialogs_request_sent = false;
var opened = false;

var vue_dialogs = new Vue({
  el: '#white-list',
  data: {
      selected_contacts_ids: selected_contacts_ids,
      all_dialogs: all_dialogs,
      search_dialogs: '',
      current_dialogs: [],
      history: {},
      loading: false,
      lists: [],
      selected_list: null,
      entering_new_list_name: false,
      new_list_name: '',
      show_names: false,
      white_list: [],
      selected_contacts_for_list: [],
      opened: false,
  },
  
  methods: {
      select_contact: function(dialog) {
          index = this.selected_contacts_ids.indexOf(dialog.id)
          if (index + 1) {
              console.log('unselecting dialog');
              this.selected_contacts_ids.splice(index, 1);
              for (i = 0; i < this.selected_contacts_for_list.length; i++) {
                  if (dialog.id == this.selected_contacts_for_list[i].id) {
                      this.selected_contacts_for_list.splice(i, 1);
                  }
              }
          } else {
              console.log('selecting dialog');
              this.selected_contacts_ids.push(dialog.id);
              this.selected_contacts_for_list.push(dialog);
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
      },
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
                    this.selected_contacts_for_list.push(list.list[i]);
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
                for (n = 0; n < this.selected_contacts_for_list.length; n++) {
                    if (list.list[i].id == this.selected_contacts_for_list[n].id) {
                        this.selected_contacts_for_list.splice(n, 1);
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
                            this.selected_contacts_for_list.push(all_dialogs[j]);
                    }
                }
            }
        }
    },
    enterNewListName: function() {
        this.entering_new_list_name = true;
    },
  changeHideShow() {
    this.opened = !this.opened
    },

    getDialogs() {
      if (all_dialogs.length != 0)
          return;
      this.loading = true;
      if (get_dialogs_request_sent) {
          this.current_dialogs = this.all_dialogs
          this.loading = false
          axios.post('dialogs/', {
                  uuidkey: uuidkey
              }).then(response => {
                
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
  addToWhiteList() {
    for (const dialog of this.selected_contacts_for_list){
      if (!this.white_list.find((element) => element.id == dialog.id)) {
        this.white_list.push(dialog)
      } 
      
    }
    axios.put('user_blacklist/', { list: this.white_list })
      .then((response) => {
        console.log(response)
      });
    this.selected_contacts_for_list = []
    this.selected_contacts_ids = []
  },
  deleteFromWhiteList (dialog){
    const index = this.white_list.findIndex((element) => element.id  == dialog.id )
    this.white_list.splice(index, 1)
    axios.put('user_blacklist/', { list: this.white_list })
      .then((response) => {
        console.log(response)
      });
    
  },

  },
  mounted() {
    axios.get('user_blacklist/')
    .then((response) => {
      this.white_list = response.data.list
    }
    )
    .catch((error) => console.log(error))
    
},
  
  
  watch: {
      search_dialogs: function(newSearchText, oldSearchText) {
          this.current_dialogs.splice(0, this.current_dialogs.length);
          this.searchText(newSearchText);
      }
  },

  

  template: `
  <div class="d-none mt-2" id="whlist">
    <div class="row justify-content-center">
      <div class="col-sm-12 col-12">
        <div class="fixed-card card-shadow" style="height: 85vh; margin-top: 0px">
          <button class="btn btn-lg btn-outline-primary btn-block" target="#chats-contacts" id="collapsing_button">White contacts list</button>
          <div id="chats-contacts">
            <button class="btn btn-light btn-block" @click="changeHideShow" id="chatHideshow">Show/hide dialogs</button>
            <div class="d-flex flex-row show">
              <div class="chats-block "  style="overflow-x: hidden; overflow-y: auto;">
                <form class="form" style="margin-bottom: 15px;">
                    <input class="form-control search" type="search" placeholder="Search" aria-label="Search" v-model="search_dialogs">
                </form>
                <div id="chats" class="sm-card collapse show">
                  <div align="center" v-if="loading">
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
              <div class=" flex-row w-lg-50 mt-2" v-bind:class="{'w-50': opened, 'w-100': !opened}">
              <button class="btn btn-light btn-block " @click="addToWhiteList" v-if="opened == false " >Your white list: </button>
                <button class="btn btn-primary btn-block " @click="addToWhiteList"  v-else >Add to white list</button>
                <div id="chats" class="sm-card collapse show">
                  <div align="center" v-if="loading">
                    <h3>
                      <div class="spinner-grow text-primary" role="status">
                        <span class="sr-only"></span>
                      </div> 
                    </h3>
                  </div>
                <transition-group name="show">
                  <div class="contact" v-for="dialog in white_list" v-bind:key="dialog.id">
                    <h5>
                      {{ dialog.name }}
                      <button type="button" v-on:click="deleteFromWhiteList(dialog)" title="Delete this message" class="ml-2 mb-2 close">
                      <span aria-hidden="true">
                        ×  
                      </span>
                    </button>
                      <span class="badge badge-pill badge-primary" v-if="dialog.unread != 0">
                        {{ dialog.unread }}
                      </span>
                    </h5>
                    <p class="message">{{ dialog.message | cutTooLong }}</p>
                  </div>  
                </transition-group>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
`
});

window.setInterval(vue_dialogs.getDialogs, 2000); 

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

$("#chatHideshow").on('click', open)
