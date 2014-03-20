/**
 * @module IRC
 */
var IRC = (function(IRC) {

  // The IRC service handles the connection to
  // the server in the background
  IRC.module.factory("IRCService", function(jolokia, $rootScope) {
    var self = {

      channels: {
        server: {
          messages: []
        }
      },
      /**
       * @property options
       * Holds a reference to the connection options when
       * a connection is started
       */
      options: undefined,
      /**
       * @property handle
       * Stores the jolokia handle after we've connected for
       * fetching updates from the backend
       */
      handle: undefined,

      isConnected: function() {
        return self.handle !== undefined
      },

      error: function(line) {
        if (line.num) {
          IRC.log.debug("error - num: ", line.num, " message: ", line.message);
        } else {
          IRC.log.debug("error - message: ", line.message);
        }
      },
      notice: function(line) {
        IRC.log.debug("notice, target: ", line.target, " user: ", line.user, " message: ", line.message);
        if (line.target === "*") {
          angular.forEach(self.channels, function(value, key) {
            IRC.log.debug("Pushing message to channel: ", key);
            value.messages.push(line);
          });
        } else {
          if (! (line.target in self.channels) ) {
            self.channels[line.target] = {
              messages: [line]
            }
          } else {
            self.channels[line.target].messages.push(line);
          }
        }

      },
      part: function(line) {
        IRC.log.debug("part - chan: ", line.chan, " user: ", line.user, " message: ", line.message);
      },
      invite: function(line) {
        IRC.log.debug("invie - chan: ", line.chan, " user: ", line.user, " passiveNick: ", line.passiveNick);
      },
      join: function(line) {
        IRC.log.debug("join - chan: ", line.chan, " user: ", line.user);
      },
      kick: function(line) {
        IRC.log.debug("kick - chan: ", line.chan, " user: ", line.user, " passiveNick: ", line.passiveNick, " message: ", line.message);
      },
      mode: function(line) {
        if (line.modeParser) {
          IRC.log.debug("mode - chan: ", line.chan, " user: ", line.user, " modeParser: ", line.modeParser);
        } else {
          IRC.log.debug("mode - chan: ", line.chan, " user: ", line.user, " mode: ", line.mode);
        }
      },
      nick: function(line) {
        IRC.log.debug("nick - user: ", line.user, " newNick: ", line.newNick);
      },
      privmsg: function(line) {
        IRC.log.debug("privmsg - target: ", line.target, " user: ", line.user, " message: ", line.message);

      },
      quit: function(line) {
        IRC.log.debug("quit - user: ", line.user, " message: ", line.message);
      },
      reply: function(line) {
        IRC.log.debug("reply, num: ", line.num, " value: ", line.value, " message: ", line.message);
        self.channels.server.messages.push(line);
      },
      topic: function(line) {
        IRC.log.debug("topic - chan: ", line.chan, " user: ", line.user, " topic: ", line.topic);
      },
      unknown: function(line) {
        IRC.log.debug("unknown - prefix: ", line.prefix, " command: ", line.command, " middle: ", line.middle, " trailing: ", line.trailing);
      },
      registered: function(line) {
        IRC.log.debug("Connected to IRC server");
        Core.notification('info', "Connected to IRC Server");


        IRC.log.debug("Channel configuration: ", self.options.channels)
        if ( self.options.channels) {
          var channels = self.options.channels.split(',');
          channels.forEach(function(channel) {
            var trimmed = channel.trim();
            if (!trimmed.startsWith("#")) {
              trimmed = "#" + trimmed;
            }
            jolokia.request({
              type: 'exec',
              mbean: IRC.mbean,
              operation: "join(java.lang.String)",
              arguments: [trimmed]
            }, {
              method: 'POST',
              success: function(response) {
                IRC.log.debug("Joined channel: ", trimmed);
                self.channels[trimmed] = {
                  messages: []
                };
                Core.$apply($rootScope);
              },
              error: function(response) {
                log.info('Failed to join channel ', trimmed, ' error: ', response.error);
                Core.$apply($rootScope);
              }
            });
          });
        }

      },
      disconnected: function(line) {
        IRC.log.debug("Disconnected from IRC server");
        Core.notification('info', "Disconnected from IRC Server");
        jolokia.unregister(self.handle);
        self.handle = undefined;
      },
      ping: function(line) {

      },

      dispatch: function(response) {
        if (response.value && response.value.length > 0) {
          response.value.forEach(function(line) {
            line['timestamp'] = Date.now();
            if (!line['type']) {
              line['type'] = 'unknown';
            }
            IRC.log.debug("Calling handler: ", line['type']);
            self[line['type']](line);
          });
          Core.$apply($rootScope);
        }
      },

      connect: function(options) {
        self.options = options;
        IRC.log.debug("Connecting to IRC service: ", options.host);
        jolokia.request({
          type: 'exec',
          mbean: IRC.mbean,
          operation: 'connect',
          arguments: [options]
        }, {
          method: 'POST',
          success: function(response) {
            IRC.log.debug("Got response: ", response);
            IRC.log.debug("Connected, registering callback");
            self.handle = jolokia.register({
              method: 'POST',
              success: function(response) {
                self.dispatch(response);
              },
              error: function(response) {
                IRC.log.info("Error fetching: ", response.error);
                IRC.log.debug("stack trace: ", response.stacktrace);
                jolokia.unregister(self.handle);
                self.handle = undefined;
              }
            }, {
              type: 'exec',
              mbean: IRC.mbean,
              operation: 'fetch',
              arguments: []
            });
          },
          error: function(response) {
            IRC.log.warn("Failed to connect to server: ", response.error);
            IRC.log.info("Stack trace: ", response.stacktrace);
          }
        });
      }
    };

    return self;
  });

  return IRC;
}(IRC || {}));