var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious').TYPES;
const date = require("date-and-time");
const request = require("request");
const sql = require('mssql');
require('dotenv').config();
let arguments = process.argv;
let username ="";

let STOP = false;

if (arguments.length >= 3) {        
       username = process.argv[2];
} else {
      console.log("USER NOT ENTERED!");
      STOP = true;
}

const auth = 'Basic ' + new Buffer(process.env.APIKEY + ':' + process.env.APIPASSWORD).toString('base64');
const legacyDBConfig = {
      user: process.env.DBUSER,
      password: process.env.DBPASSWORD,
      server: process.env.DBSERVER,
      database: process.env.DATABASE,
      encrypt: true
}

console.log(auth);

const newDBConfig = {
      userName: process.env.NEWDBUSER,
      password: process.env.NEWDBPASSWORD,
      server: process.env.NEWDBSERVER,
      // If you are on Azure SQL Database, you need these next options.
      options: {
            encrypt: true,
            database: process.env.NEWDATABASE
      }
}

const getDateBegin = (i) => {
      let now = new Date('2018/01/01');
      let yesterday = date.addDays(now, (i * 7));
      const month = yesterday.getMonth() + 1;
      const day = yesterday.getDate();
      const year = yesterday.getFullYear();

      let stringMonth = month.toString();
      let stringDay = day.toString();

      if (stringMonth.length < 2) {
            stringMonth = "0" + stringMonth;
      }

      if (stringDay.length < 2) {
            stringDay = "0" + stringDay;
      }

      return `${year}-${stringMonth}-${stringDay}`;
}

const getDateEnd = (i) => {
      let days = (i * 7) + 6;
      let now = new Date('2018/01/01');
      let yesterday = date.addDays(now, days);
      const month = yesterday.getMonth() + 1;
      const day = yesterday.getDate();
      const year = yesterday.getFullYear();

      let stringMonth = month.toString();
      let stringDay = day.toString();

      if (stringMonth.length < 2) {
            stringMonth = "0" + stringMonth;
      }

      if (stringDay.length < 2) {
            stringDay = "0" + stringDay;
      }

      return `${year}-${stringMonth}-${stringDay}`;
}


const a = (startObj) => {
      return new Promise((resolve, reject) => {
            const options = {
                  'url': startObj.url,
                  'headers': {
                        'Authorization': auth,
                        'Accept': 'application/json'
                  }
            }
            request(options, function (error, response, body) {
                  if (error) {
                        console.log('error:', error); // Print the error if one occurred
                  }
                  if (error) {
                        reject(error);
                  } else {
                        let response = JSON.parse(body);
                        let counter = 0.0;
                        for (let i = 0; i < response.listcount; i++) {
                              counter += parseInt(response.time[i].time);
                        }

                        const dataToReturn = {
                              ...startObj,
                              counter: counter
                        }
                        resolve(dataToReturn);
                  }
            });
      });
}

const writeObjectToDatabase = (objectToWrite) => {
      return new Promise((resolve, reject) => {
            let compliant = "false";
            if (objectToWrite.counter >= 40) {
                  compliant = "true";
            }

            var connection = new Connection(newDBConfig);
            connection.on('connect', function (err) {
                  let request = new Request(`INSERT INTO reports (firstname, lastname, datestart, dateend, compliant, totalhours) VALUES ('${objectToWrite.dbObject[0].firstname}', '${objectToWrite.dbObject[0].lastname}', '${objectToWrite.datebegin}', '${objectToWrite.dateend}', '${compliant}', ${objectToWrite.counter});`, function (err) {
                        if (err) {
                              console.log(err);
                              reject(err);
                        }
                        request.on('row', function (columns) {
                              columns.forEach(function (column) {
                                    if (column.value === null) {
                                          console.log('NULL');
                                    } else {
                                          console.log("Product id of inserted item is " + column.value);
                                    }
                              });
                        });
                  });
                  connection.execSql(request);
            });
            resolve("Executed Order number 66");
      });
}

const getUserObject = (fn) => {
      var promise = new Promise(function (resolve, reject) {
            sql.connect(legacyDBConfig, function (err) {
                  if (err) console.log(err);
                  var request = new sql.Request();
                  request.query(`select * from users where firstname='${fn}'`, function (err, recordset) {
                        if (err) {
                              reject(err);
                        } else {
                              resolve(recordset.recordset);
                        }
                  });
            });
      })
      return promise;
}

if (STOP == false) {
      getUserObject(username).then((userObject) => {
            for (let i = 0; i < 52; i++) {
                  let id = userObject[0].intervalsID;
                  let url = `https://api.myintervals.com/time/?personid=${id}&datebegin=${getDateBegin(i)}&dateend=${getDateEnd(i)}&limit=100`;
                  const object = {
                        datebegin: getDateBegin(i),
                        dateend: getDateEnd(i),
                        url: url,
                        dbObject: userObject
                  }

                  a(object).then((result) => {
                        return writeObjectToDatabase(result);
                  }).then((didWrite) => {
                        console.log(didWrite);
                  })
            }
      });
}