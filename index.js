const start_time = Date.now();

const log4js = require('log4js');
log4js.configure({
  appenders: [{
    type: 'console'
  }, {
    type: 'file',
    filename: 'server.log'
  }]
});
const logger = log4js.getLogger('web-calendar');
logger.setLevel('TRACE');
logger.info('Starting web calendar by Nicolas Chan');

const config = require('./config.json');

const async = require('async');

const colors = require('colors');

const express = require('express');
const app = express();
const body_parser = require('body-parser');

const mysql = require('mysql');
const connection = mysql.createConnection(config.database);

var getUsers = function(callback) {
  async.waterfall([(callback) => {
    connection.query('SELECT * FROM users', (err, rows, fields) => {
      callback(null, rows);
    });
  }, (users, callback) => {
    connection.query('SELECT * FROM cards', (err, rows, fields) => {
      callback(null, users, rows);
    });
  }, (users, cards, callback) => {
    var result = {};
    for (var i in users) {
      var user = {
        userId: users[i].id,
        name: `${users[i].name} ${users[i].surname}`,
        active: (parseInt(users[i].active) === 1) ? true : false
      };
      result[user.userId] = user;
    }
    for (var i in cards) {
      if (!result[cards[i].userId])
        continue;
      result[cards[i].userId].tagId = cards[i].tagId;
    }

    var final = [];
    for (var key in result) {
      final.push(result[key]);
    }

    callback(null, final);
  }], (err, users) => callback(users));
};
var getEvents = function(callback) {
  async.waterfall([(callback) => {
    connection.query('SELECT * FROM readings', (err, rows, fields) => {
      callback(null, rows);
    });
  }, (readings, callback) => {
    getUsers((users) => callback(null, readings, users));
  }, (readings, users, callback) => {
    var result = [];
    for (var i in readings) {
      for (var j in users) {
        if (users[j].tagId === readings[i].tagId) {
          var reading = readings[i];
          reading.userId = users[j].userId;
          reading.name = users[j].name;
          result.push(reading);
        }
      }
    }
    callback(null, result);
  }], (err, readings) => callback(readings));
};

var getData = function(callback) {
  var data = {};
  async.parallel([(callback) => {
    getUsers((users) => {
      data.users = users;
      logger.debug(`Found ${data.users.length} users`);
      callback();
    });
  }, (callback) => {
    getEvents((events) => {
      data.events = events;
      logger.debug(`Found ${data.events.length} readings`);
      callback();
    });
  }], (err) => callback(data));
};

var deleteUser = function(id, callback) {
  var id = connection.escape(id);
  connection.query(`DELETE FROM users WHERE id=${id}`, (err, rows, fields) => callback(err));
};
var updateUser = function(user, callback) {
  var id = connection.escape(user.userId);
  var tagId = connection.escape(user.tagId);
  var name = connection.escape(user.name.split(' ')[0]);
  var surname = connection.escape(user.name.split(' ')[1]);
  var active = (user.active === 'true') ? '\'1\'' : '\'0\'';

  async.parallel([
    (callback) => connection.query(`UPDATE users SET name=${name} WHERE id=${id}`, callback), (callback) => connection.query(`UPDATE users SET surname=${surname} WHERE id=${id}`, callback), (callback) => connection.query(`UPDATE users SET active=${active} WHERE id=${id}`, callback), (callback) => connection.query(`UPDATE cards SET tagid=${tagId} WHERE userId=${id}`, callback)
  ], callback);
};
var addUser = function(user, callback) {
  var tagId = connection.escape(user.tagId);
  var name = connection.escape(user.name.split(' ')[0]);
  var surname = connection.escape((user.name.split(' ')[1]) ? user.name.split(' ')[1] : ' ');
  var active = (user.active === 'true') ? '\'1\'' : '\'0\'';
  async.waterfall([(callback) => {
    connection.query(`INSERT INTO users (name, surname, active) VALUES (${name}, ${surname}, ${active})`, (err, rows, fields) => {
      callback(null);
    });
  }, (callback) => {
    connection.query('SELECT * FROM users WHERE id=(SELECT MAX(id) FROM users)', (err, rows, fields) => {
      callback(null, rows[0]);
    });
  }, (user, callback) => {
    connection.query(`INSERT INTO cards (userId, tagId) VALUES (${user.id}, ${tagId})`, () => callback(null, user));
  }], (err, user) => {
    if (err)
      return callback(err);
    return callback(null, {
      userId: user.id,
      name: `${user.name} ${user.surname}`,
      tagId: parseInt(tagId.substring(1, tagId.length - 1)),
      active: (user.active === '1') ? true : false
    });
  });
};

app.set('view engine', 'jade');
app.use('/static', express.static('bower_components'));
app.use(body_parser.json());
app.use(body_parser.urlencoded({
  extended: true
}));
app.get('/main.js', (req, res) => {
  res.sendFile(__dirname + '/main.js');
});
app.get('/', (req, res) => {
  logger.trace(`${req.connection.remoteAddress} - Requesting page`);
  getData((data) => res.render('index', data));
});
app.post('/api/delete', (req, res) => {
  logger.debug(`${req.connection.remoteAddress} - Attempting delete: ${JSON.stringify(req.body)}`);
  res.set('Content-Type', 'text/json');
  var userId = req.body.userId;
  deleteUser(userId, (err) => {
    if (err) {
      logger.error(`${req.connection.remoteAddress} - Failed to delete user: ${JSON.stringify(req.body)}`);
      return res.send({
        userId: userId,
        success: false,
        message: err.code
      });
    }
    logger.info(`${req.connection.remoteAddress} - Successfully deleted user #${userId}`);
    return res.send({
      userId: userId,
      success: true
    });
  });
});
app.post('/api/edit', (req, res) => {
  logger.debug(`${req.connection.remoteAddress} - Attempting edit: ${JSON.stringify(req.body)}`);
  res.set('Content-Type', 'text/json');
  updateUser(req.body, (err) => {
    if (err) {
      logger.error(`${req.connection.remoteAddress} - Failed to edit user: ${JSON.stringify(req.body)}`);
      return res.send({
        userId: req.body.userId,
        user: req.body,
        success: false,
        message: err.code
      });
    }
    req.body.active = (req.body.active === 'true') ? true : false;
    req.body.userId = parseInt(req.body.userId);
    logger.info(`${req.connection.remoteAddress} - Successfully edited user #${req.body.userId}`);
    return res.send({
      userId: req.body.userId,
      user: req.body,
      success: true
    });
  });
});
app.post('/api/add', (req, res) => {
  logger.debug(`${req.connection.remoteAddress} - Attempting add: ${JSON.stringify(req.body)}`);
  res.set('Content-Type', 'text/json');
  addUser(req.body, (err, user) => {
    if (err) {
      logger.error(`${req.connection.remoteAddress} - Failed to add user: ${JSON.stringify(req.body)}`);
      return res.send({
        user: req.body,
        success: false,
        message: err.code
      });
    }
    user.userId = parseInt(user.userId);
    logger.info(`${req.connection.remoteAddress} - Successfully added user #${user.userId}`);
    return res.send({
      userId: user.userId,
      user: user,
      success: true
    });
  });
});

var executeCommand = function(str, callback) {
  str = str.substring(0, str.length - 1);
  var cmd = str.split(' ')[0];
  var args = str.split(' ').splice(1);
  switch (cmd) {
    case 'stop':
    case 'quit':
    case 'exit':
      logger.info('Stopping');
      return process.exit();
    case 'show':
      if (args[0] === 'users')
        return getUsers(callback);
      if (args[0] === 'readings')
        return getEvents(callback);
      return callback('Must choose \'users\' or \'readings\'');
    default:
      return callback(['stop/quit/exit: stops this program', 'show [users/readings]: displays the current users or readings']);
  }
};

process.stdin.setEncoding('utf8');
process.stdin.on('readable', () => {
  var chunk = process.stdin.read();
  if (chunk !== null) {
    executeCommand(chunk, (result) => {
      console.log(`${'Command:'.yellow} ${chunk.substring(0, chunk.length - 1)}`);
      console.log(`${'Result:'.yellow} ${JSON.stringify(result)}`);
    });
  }
});
process.stdin.on('end', () => {
  logger.debug('Stdin ending');
});
process.on('SIGINT', () => {
  logger.info('Stopping');
  process.exit();
});

async.series([(callback) => {
  connection.connect((err, data) => {
    if (!err) {
      logger.debug('Successfully connected to database');
      return callback();
    }
    logger.fatal('Could not connect to database');
    return callback(err);
  });
}, (callback) => {
  app.listen(config.port, (err) => {
    if (!err) {
      logger.debug(`Web server started on http://localhost:${config.port}`);
      return callback();
    }
    logger.fatal('Error starting web server');
    return callback(err);
  });
}], (err) => {
  if (err)
    return logger.fatal(err.toString());
  return logger.info(`Start complete (${(Date.now() - start_time) / 1000}s)! Type \'help\' for available commands`);
});