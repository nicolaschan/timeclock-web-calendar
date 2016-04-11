var convertDate = function(num) {
  var str = num.toString();
  var year = str.substring(0, 4);
  var month = str.substring(4, 6);
  var day = str.substring(6, 8);
  var hour = str.substring(8, 10);
  var min = str.substring(10, 12);
  var sec = str.substring(12, 14);
  return new Date(year, month, day, hour, min, sec);
};
var actionString = function(num) {
  switch (num) {
    case 1:
      return 'checked in';
    case 2:
      return 'checked out';
    case 3:
      return 'break start';
    case 4:
      return 'break end';
    default:
      return 'unknown';
  }
};

var selectedUserId;

function displayUsers(users, filter) {
  var getWorkingHours = function(id) {
    if (!($('#startDate').val() && $('#endDate').val()))
      return 0;

    var working = false;
    var working_since = 0;
    var hours = 0;

    var startDate = new Date($('#startDate').val()).getTime();
    var endDate = new Date($('#endDate').val()).getTime();
    for (var i in events) {
      if (events[i].userId != id)
        continue;
      var time = convertDate(events[i].time).getTime();
      if (!(time >= startDate && time <= endDate))
        continue;
      if (events[i].action == 1 || events[i].action == 4) {
        // started working
        if (!working) {
          working = true;
          working_since = time;
        }
      }
      if (events[i].action == 2 || events[i].action == 3) {
        // stopped working
        if (working)
          hours += (time - working_since) / 1000 / 60 / 60;
        working = false;
      }
    }

    return Math.round(hours * 100) / 100;
  };
  var getBreakHours = function(id) {
    if (!($('#startDate').val() && $('#endDate').val()))
      return 0;

    var on_break = false;
    var on_break_since;
    var hours = 0;

    var startDate = new Date($('#startDate').val()).getTime();
    var endDate = new Date($('#endDate').val()).getTime();
    for (var i in events) {
      if (events[i].userId != id)
        continue;
      var time = convertDate(events[i].time).getTime();
      if (!(time >= startDate && time <= endDate))
        continue;
      if (events[i].action == 3) {
        // started break
        if (!on_break) {
          on_break = true;
          on_break_since = time;
        }
      }
      if (events[i].action == 1 || events[i].action == 2 || events[i].action == 4) {
        // stopped break
        if (on_break)
          hours += (time - on_break_since) / 1000 / 60 / 60;
        on_break = false;
      }
    }

    return Math.round(hours * 100) / 100;
  };

  $('#userList').empty();
  for (var i in users) {
    if (filter && !users[i].name.toLowerCase().includes(filter.toLowerCase()))
      continue;
    var collapsible = $('<li></li>');
    var header = $('<div></div>');
    header.addClass('collapsible-header');
    var icon = $('<i></i>');
    icon.addClass('material-icons');
    icon.text('account_circle');
    header.append(icon);
    header.append(document.createTextNode(users[i].name));
    collapsible.append(header);

    var body = $('<div></div>');
    body.addClass('collapsible-body');
    var content = $('<p></p>');
    content.append($('<strong>User ID </strong>'));
    content.append(document.createTextNode(users[i].userId));
    content.append($('<br>'));
    content.append($('<strong>Tag ID </strong>'));
    content.append(document.createTextNode(users[i].tagId));
    content.append($('<br>'));
    content.append($('<strong>Active </strong>'));
    content.append(document.createTextNode(users[i].active));
    content.append($('<br>'));
    var hours_worked = getWorkingHours(users[i].userId);
    var break_hours = getBreakHours(users[i].userId);
    if (hours_worked || break_hours) {
      content.append($('<strong>Hours worked in selection </strong>'));
      content.append(`${hours_worked} ${(hours_worked == 1) ? 'hour' : 'hours'}`);
      content.append($('</br>'));
      content.append($('<strong>Hours of break in selection </strong>'));
      content.append(`${break_hours} ${(break_hours == 1) ? 'hour' : 'hours'}`);
      content.append($('</br>'));
    }
    body.append(content);

    var container = $('<div></div>');
    container.addClass('container');
    var row = $('<div></div>');
    row.addClass('row');
    var edit_button = $('<a></a>');
    edit_button.addClass('waves-effect waves-light btn green col s3');
    edit_button.attr('id', `userEdit-${users[i].userId}`);
    edit_button.click((e) => {
      var userId = e.target.id.split('-')[1];
      selectedUserId = userId;
      var user;
      for (var i in users) {
        if (users[i].userId == userId) {
          user = users[i];
          break;
        }
      }
      if (!user)
        return;
      $('#editId').text(`#${userId}`);
      $('#editName').val(user.name);
      $('#editName').removeClass('valid');
      $('#editTagId').val(user.tagId);
      $('#editTagId').removeClass('valid');
      $('#editActive').prop('checked', user.active);

      $('#modalEdit').openModal();
    });
    var edit_icon = $('<i></i>');
    edit_icon.addClass('material-icons');
    edit_icon.text('mode_edit');
    edit_button.append(edit_icon);
    row.append(edit_button);
    var delete_button = $('<a></a>');
    delete_button.addClass('waves-effect waves-light btn red col s3 offset-s5');
    delete_button.attr('user', users[i].userId);
    delete_button.attr('id', `userDelete-${users[i].userId}`);
    delete_button.click((e) => {
      var userId = e.target.id.split('-')[1];
      $.post('/api/delete', {
        userId: userId
      }).done((res) => {
        if (res.success) {
          Materialize.toast(`User #${userId} deleted`, 4000, 'green');
          for (var i in users) {
            if (users[i].userId == userId)
              users.splice(i, 1);
          }
          displayUsers(users, $('#nameFilter').val());
          displayEvents(events);
        } else {
          Materialize.toast(`Error deleting user: ${res.message}`, 4000, 'red');
        }
      });
    });
    var delete_icon = $('<i></i>');
    delete_icon.addClass('material-icons');
    delete_icon.text('delete_forever');
    delete_button.append(delete_icon);
    row.append(delete_button);
    container.append(row);
    body.append(container);

    collapsible.append(body);

    $('#userList').append(collapsible);
  }
}

function displayEvents(events) {
  var getColor = function(num) {
    switch (num) {
      case 1:
        return 'green';
      case 2:
        return 'red';
      case 3:
        return 'pink';
      case 4:
        return 'lime';
      default:
        return 'gray';
    }
  };
  var userExists = function(id, tagId) {
    for (var i in users) {
      if (users[i].userId === id)
        return users[i].tagId == tagId;
    }
    return false;
  };

  $('#calendar').fullCalendar('removeEvents');
  for (var i in events) {
    if (!userExists(events[i].userId, events[i].tagId))
      continue;
    var time = events[i].time.toString()
    var event = {
      title: `${events[i].name} ${actionString(events[i].action)}`,
      start: convertDate(events[i].time),
      color: getColor(events[i].action)
    };
    $('#calendar').fullCalendar('renderEvent', event, true);
  }
}

$(document).ready(function() {
  $('#calendar').fullCalendar({
    header: {
      left: 'title',
      center: '',
      right: 'today month,basicWeek,agendaDay prev,next'
    }
  });
  var event = {
    title: 'my title',
    start: new Date()
  };

  displayEvents(events);
  displayUsers(users);

  $('#nameFilter').keyup(function() {
    displayUsers(users, $('#nameFilter').val());
  });

  $('.datepicker').pickadate({
    selectMonths: true,
    selectYears: 15
  });
  $('#startDate').change(() => displayUsers(users, $('#nameFilter').val()));
  $('#endDate').change(() => displayUsers(users, $('#nameFilter').val()));

  $('.modal-trigger').leanModal();

  $('#confirmEdit').click(() => {
    $.post('/api/edit', {
      userId: selectedUserId,
      name: $('#editName').val(),
      tagId: $('#editTagId').val(),
      active: $('#editActive').is(':checked')
    }).done((res) => {
      if (res.success) {
        Materialize.toast(`User #${res.userId} updated`, 4000, 'green');
        for (var i in users) {
          if (users[i].userId == selectedUserId) {
            users[i] = res.user;
            break;
          }
        }
        displayUsers(users, $('#nameFilter').val());
        displayEvents(events);
      } else {
        Materialize.toast(`Error editing user: ${res.message}`, 4000, 'red');
      }
    });
  });

  $('#addButton').click((e) => {
    $('#modalAdd').openModal();
  });
  $('#confirmAdd').click(() => {
    $.post('/api/add', {
      name: $('#addName').val(),
      tagId: $('#addTagId').val(),
      active: $('#addActive').is(':checked')
    }).done((res) => {
      if (res.success) {
        Materialize.toast(`User #${res.userId} added`, 4000, 'green');
        users.push(res.user);
        displayUsers(users, $('#nameFilter').val());
        displayEvents(events);

        $('#addName').val('');
        $('#addName').removeClass('valid');
        $('#addTagId').val('');
        $('#addTagId').removeClass('valid');
        $('#addActive').prop('checked', false);
      } else {
        Materialize.toast(`Error adding user: ${res.message}`, 4000, 'red');
      }
    });
  });
});