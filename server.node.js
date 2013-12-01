/*
backend for same-artist memory game 
Like memory, but the pictures are not the same, just by the same artist.

*/


var urlparser = require("url");
var fs = require("fs");
var pathparser = require("path");


var async = require("async");


var db_name = "objecttags";

var nano = require('nano')('http://localhost:5984');
var db = nano.use(db_name);
var $ = require("jquery");

var port = 1337;
if(process && process.env && process.env.NODE_ENV == "production"){
  port = 80;
}
// create some sample objects, put in couchdb

 var num_pairs = 18;



var http = require('http');
http.createServer(function (req, res) {
  parseRequest(req, res);

}).listen(port);
console.log('Server running at port ' + port);



function getMatchingPair(callback){
  getRandomObject(function(object){
    if(!object){
      console.log("didn't get object");
      getMatchingPair(callback);
    }else{
      var who = object.value.who;
      var id = object.id;

      getRandomObjectByWho(who, id,
        function(matchingObject){
          // got a matching object
          callback(object, matchingObject);
        },
        function(who){
          // this person's no good, not enough samples.
          getMatchingPair(callback);
        });
    }

  });

}


function parseRequest(req, res){
  var parsed = urlparser.parse(req.url, true)
  var query = urlparser.parse(req.url, true).query;
  console.log('~~~~~~~~~~~~~~~~~');
 // console.log(parsed);
  console.log('~~~~~~~~~~~~~~~~~');
  //console.log(query);
  console.log('~~~~~~~~~~~~~~~~~');

  if(!query.action){
    sendFile(parsed.pathname, query, res);
  }else if (query.action == "getObjectList"){
    getObjectList(query.num_pairs, query, res);
  }else{
   res.writeHead(200, {'Content-Type': 'text/html'});
   res.end("<html><body><pre>not sure what to do</pre></body></html>");
  }




}

var dataCache = {};
function sendFile(path, query, res){

  if(path == "/"){
    path = "/index.html";
  }
  var extname = pathparser.extname(path);
  var contentType = 'text/html';
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
  }

  if(!dataCache[path]){
    fs.readFile("."+path, function(err, data){
      if(err){
        console.log("file read error");
        console.log(err);
        res.writeHead(404, {'Content-Type': contentType});
        //indexhtml = data;
        res.end(data);
      }else{
        res.writeHead(200, {'Content-Type': contentType});
        console.log("writing file " + path);
     //   console.log(data);
        //dataCache[path] = data;
        res.end(data);
      }
    });
  }else{
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(dataCache[path]);
  }
}

function getObjectList(num_pairs, req, res){
  var pairlist = [];
  var names = {}
  console.log("pairlist " + pairlist.length);
  var i_count = 0;
  async.whilst(
    function(){return i_count < num_pairs;},
    function(callback){
      getMatchingPair(function(object1, object2){
        console.log(object1.id + " : " + object1.value.who);
        console.log(object2.id + " : " + object2.value.who);
        if(!names[object1.value.who]){
          object1.match = object2.id;
          object2.match = object1.id;
          pairlist.push([object1, object2]);
          names[object1.value.who] = true;
          i_count++;
          console.log( " count " + i_count);
        }

        callback();
      });
    },
    function(err){
      var contentType = "application/json";
      res.writeHead(200, {'Content-Type': contentType});
      res.end(JSON.stringify(pairlist));
      console.log("done");
      console.log(pairlist);
    }
  );

}

function getRandomObject(callback){
  // get total number of objects:
  // got these instructions from http://stackoverflow.com/questions/3779605/how-do-i-load-a-random-document-from-couchdb-efficiently-and-fairly
  db.view("objecttagger",  "rand_objects" , function(err, body){
    if(err){
      console.log("error getting summary");
      console.log(err);
      return;
    }else{
      var num_rows= body.rows[0].value;
      var rand  = Math.random();
      var rand_i = Math.floor(num_rows * rand);

      // get number of docs with an index lower than rand_i

      db.view("objecttagger",  "rand_objects" , {endkey: rand } ,function(err2, body2){
        if(err2){
          console.log("2 error getting summary");
          console.log(err2);
          return;
        }else{
           var num_rows2 = body2.rows[0].value;
           var skip = rand_i - num_rows2;
           if(skip >= 0){
             db.view("objecttagger",  
                      "rand_objects" , 
                      {startkey: rand , skip: skip, limit: 1, reduce: false } ,
                      function(err3, body3){
                        if(err3){
                          console.log("3 error getting summary");
                          console.log(err3);
                          return;
                        }else{
                          if(!body3.rows[0]){
                            console.log("no object found ");
                            console.log(body3);
                          }
                          callback(body3.rows[0]);                           
                        }
                      }
              );
           }else{
              db.view("objecttagger",  
                      "rand_objects" , 
                      {startkey: rand , descending: true, skip: -1 * (skip + 1), limit: 1, reduce: false } ,
                      function(err3, body3){
                        if(err3){
                          console.log("3 error getting summary");
                          console.log(err3);
                          return;
                        }else{
                       //    console.log("3 got results");
                      //     console.log(body3.rows[0]);
                      //     console.log("calling callback");
                          if(!body3.rows[0]){
                            console.log("no object found ");
                            console.log(body3);
                          }

                          callback(body3.rows[0]);
                        }
                      }
              );
           }
        }
      });
    }
  });
}


function getRandomObjectByWho(who, skipid, callback, failcallback){
  // get total number of objects:
  // got these instructions from http://stackoverflow.com/questions/3779605/how-do-i-load-a-random-document-from-couchdb-efficiently-and-fairly
  db.view("objecttagger",  "objects_by_who" , {keys : [who], group: true}, function(err, body){
    if(err){
      console.log("error getting summary");
      console.log(err);
      return;
    }else{
      console.log(body);
      var num_rows= body.rows[0].value;
      if(num_rows <= 1){
        // this persons no good
        failcallback(who);
        return;
      }

      var only_two = false;
      if(num_rows == 2){
        only_two = true;
      }

      var rand  = Math.random();
      var rand_i = Math.floor(num_rows * rand);
    
      // get number of docs with an index lower than rand_i

      db.view("objecttagger",  "rand_objects_by_who" , {startkey: [who, 0], endkey: [who, rand]} ,function(err2, body2){
        if(err2){
          console.log("2w error getting summary");
          console.log(err2);
          return;
        }else{
           var num_rows2 = 0;
           if(!body2.rows[0]){
            num_rows = 0;
           }else{
             num_rows2 = body2.rows[0].value;
           }
           var skip = rand_i - num_rows2;
           if(skip >= 0){
             db.view("objecttagger",  
                      "rand_objects_by_who" , 
                      { startkey: [who, rand] , endkey: [who, 1.0], skip: skip, limit: 1, reduce: false } ,
                      function(err3, body3){
                        if(err3){
                          console.log("3 error getting summary");
                          console.log(err3);
                          return;
                        }else{
                           if(body3.rows[0].id == skipid){
                              getRandomObjectByWho(who, skipid, callback, failcallback);
                           }else{
                             callback(body3.rows[0]);
                           }
                        }
                      }
              );
           }else{
              db.view("objecttagger",  
                      "rand_objects_by_who" , 
                      {startkey: [who, rand] , descending: true, skip: -1 * (skip + 1), limit: 1, reduce: false } ,
                      function(err3, body3){
                        if(err3){
                          console.log("3 error getting summary");
                          console.log(err3);
                          return;
                        }else{
                        //   console.log(body3.rows[0]);
                           if(body3.rows[0].id == skipid){
                              getRandomObjectByWho(who, skipid, callback, failcallback);
                           }else{
                             callback(body3.rows[0]);
                           }
                        }
                      }
              );
           }
        }
      });
    }
  });


}