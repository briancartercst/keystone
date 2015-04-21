var keystone = require('../..'),
	sinon = require('sinon');

describe('Keystone.session', function() {

	describe('keystone.session.signinWithUser()', function() {
		// mock args for signinWithUser(user, req, res, onSuccess)
		var res = {
				cookie: sinon.stub()
			},
			onSuccess = sinon.stub(),
			user,
			req;

		function resetMocks() {
			user = {
				id: 'USERID',
				password: 'PASSWORD'
			};
			req = {
				user: null,
				session: {
					userId: null,
					regenerate: function(callback) {
						callback();
					}
				}
			};
		}

		before(function() {
			keystone.get('cookie secret', 'SECRET');
			keystone.set('user model', 'User');
		});

		beforeEach(function() {
			resetMocks();
			sinon.spy(req.session, 'regenerate');
		});

		afterEach(function() {
			req.session.regenerate.reset();
			res.cookie.reset();
			onSuccess.reset();
		});

		describe('with valid args, "cookie signin" on', function() {

			it('should regenerate session, set user, session.userId, and res.cookie', function() {
				keystone.set('cookie signin', true);
				keystone.session.signinWithUser(user, req, res, onSuccess);

				sinon.assert.calledOnce(req.session.regenerate);

				req.user.must.equal(user);
				req.session.userId.must.equal(user.id);

				sinon.assert.calledOnce(res.cookie);
				sinon.assert.calledWith(res.cookie, 'keystone.uid');

				sinon.assert.calledOnce(onSuccess);
				sinon.assert.calledWithExactly(onSuccess, user);
			});

		});

		describe('with valid args, "cookie signin" off', function() {

			it('should regenerate session, set user, session.userId', function() {
				keystone.set('cookie signin', false);
				keystone.session.signinWithUser(user, req, res, onSuccess);

				sinon.assert.calledOnce(req.session.regenerate);

				req.user.must.equal(user);
				req.session.userId.must.equal(user.id);

				sinon.assert.callCount(res.cookie, 0);

				sinon.assert.calledOnce(onSuccess);
				sinon.assert.calledWithExactly(onSuccess, user);
			});

		});

		describe('with invalid args', function() {
			it('should error when called less then 4 args', function() {
				function callWithNoArgs() {
					keystone.session.signinWithUser();
				}
				callWithNoArgs.must.throw('keystone.sesson.signinWithUser requires user, req and res objects, and an onSuccess callback.');

				function callWithOneArg() {
					keystone.session.signinWithUser(user);
				}
				callWithOneArg.must.throw('keystone.sesson.signinWithUser requires user, req and res objects, and an onSuccess callback.');

				function callWithTwoArgs() {
					keystone.session.signinWithUser(user, req);
				}
				callWithOneArg.must.throw('keystone.sesson.signinWithUser requires user, req and res objects, and an onSuccess callback.');

				function callWithThreeArgs() {
					keystone.session.signinWithUser(user, req, res);
				}
				callWithOneArg.must.throw('keystone.sesson.signinWithUser requires user, req and res objects, and an onSuccess callback.');
			});

			it('should error when user arg is not an object', function() {
				function callWithInvalidUser() {
					keystone.session.signinWithUser('user', req, res, onSuccess);
				}
				callWithInvalidUser.must.throw('keystone.sesson.signinWithUser requires user to be an object.');
			});

			it('should error when req arg is not an object', function() {
				function callWithInvalidReq() {
					keystone.session.signinWithUser(user, 'req', res, onSuccess);
				}
				callWithInvalidReq.must.throw('keystone.sesson.signinWithUser requires req to be an object.');
			});

			it('should error when res arg is not an object', function() {
				function callWithInvalidRes() {
					keystone.session.signinWithUser(user, req, 'res', onSuccess);
				}
				callWithInvalidRes.must.throw('keystone.sesson.signinWithUser requires res to be an object.');
			});

			it('should error when onSuccess arg is not a function', function() {
				function callWithInvalidCallback() {
					keystone.session.signinWithUser(user, req, res, 'onSuccess');
				}
				callWithInvalidCallback.must.throw('keystone.sesson.signinWithUser requires onSuccess to be a function.');
			});

		});

	});

	// TODO: need more test for keystone.session.signin()
	describe('keystone.session.signin()', function() {

		describe('case-insensitive email lookup', function() {

			before(function() {
				var self = this;
				this.onSuccess = sinon.stub();
				this.onFailure = sinon.stub();

				// simulate User model
				this.User = {
					model: {
						findOne: sinon.spy(function(query) {
							self.query = query;
							return this;
						}),
						exec: sinon.spy(function(callback) {
							var email = 'test@test.com';
							self.query.match = self.query.email.test(email);
							if (self.query.match) {
								return callback(null, self.user);
							}
							callback(new Error('not found'))
						})
					}
				};

				// simulate user instance
				this.user = {
					_: {
						password: {
							compare: sinon.spy(function(password, callback) {
								callback(null, true);
							})
						}
					}
				};

				keystone.set('user model', 'User');
				sinon.stub(keystone, 'list').withArgs('User').returns(this.User);
				sinon.stub(keystone.session, 'signinWithUser').callsArg(3);
			});

			after(function() {
				keystone.list.restore();
				keystone.session.signinWithUser.restore();
			});

			afterEach(function() {
				delete this.query;

				this.User.model.findOne.reset();
				this.User.model.exec.reset();
				this.onSuccess.reset();
				this.onFailure.reset();

				keystone.list.reset();
				keystone.session.signinWithUser.reset();
			});

			it('shoud match email with mixed case', function () {
				var lookup = { email: 'Test@Test.Com', password: 'password'};

				keystone.session.signin(lookup, null, null, this.onSuccess, this.onFailure);

				// make sure .findOne() is called with a regular expression
				sinon.assert.calledOnce(this.User.model.findOne);
				this.User.model.findOne.getCall(0).args[0].email.must.be.instanceof(RegExp);
				// make sure .exec() is called after
				sinon.assert.calledOnce(this.User.model.exec);
				this.User.model.exec.calledAfter(this.User.model.findOne).must.be.true;
				// make sure .signinWithUser() is called on successful match
				sinon.assert.calledOnce(keystone.session.signinWithUser);
				// make sure onSuccess callback is called on successful match
				sinon.assert.calledOnce(this.onSuccess);
			});

			it('shoud match email with all uppercase', function () {
				var lookup = { email: 'TEST@TEST.COM', password: 'password'};
				keystone.session.signin(lookup, null, null, this.onSuccess, this.onFailure);

				// make sure .findOne() is called with a regular expression
				sinon.assert.calledOnce(this.User.model.findOne);
				this.User.model.findOne.getCall(0).args[0].email.must.be.instanceof(RegExp);
				// make sure .exec() is called after
				sinon.assert.calledOnce(this.User.model.exec);
				this.User.model.exec.calledAfter(this.User.model.findOne).must.be.true;
				// make sure .signinWithUser() is called on successful match
				sinon.assert.calledOnce(keystone.session.signinWithUser);
				// make sure onSuccess callback is called on successful match
				sinon.assert.calledOnce(this.onSuccess);
			});

			it('shoud match email with all lowercase', function () {
				var lookup = { email: 'test@test.com', password: 'password'};
				keystone.session.signin(lookup, null, null, this.onSuccess, this.onFailure);

				// make sure .findOne() is called with a regular expression
				sinon.assert.calledOnce(this.User.model.findOne);
				this.User.model.findOne.getCall(0).args[0].email.must.be.instanceof(RegExp);
				// make sure .exec() is called after
				sinon.assert.calledOnce(this.User.model.exec);
				this.User.model.exec.calledAfter(this.User.model.findOne).must.be.true;
				// make sure .signinWithUser() is called on successful match
				sinon.assert.calledOnce(keystone.session.signinWithUser);
				// make sure onSuccess callback is called on successful match
				sinon.assert.calledOnce(this.onSuccess);
			});

			it('shoud not match email when invalid', function () {
				var lookup = { email: 'xxx', password: 'password'};
				keystone.session.signin(lookup, null, null, this.onSuccess, this.onFailure);

				// make sure .findOne() is called with a regular expression
				sinon.assert.calledOnce(this.User.model.findOne);
				this.User.model.findOne.getCall(0).args[0].email.must.be.instanceof(RegExp);
				// make sure .exec() is called after
				sinon.assert.calledOnce(this.User.model.exec);
				this.User.model.exec.calledAfter(this.User.model.findOne).must.be.true;
				// make sure .signinWithUser() is NOT called on failed match
				sinon.assert.notCalled(keystone.session.signinWithUser);
				// make sure onFailure callback is called on failed match
				sinon.assert.calledOnce(this.onFailure);
			});

		});

	});

	// TODO: test keystone.session.signout()
	// describe('keystone.session.signout()');

	// TODO: test keystone.session.persist()
	// describe('keystone.session.persist()');

	// TODO: test keystone.session.keystoneAuth()
	// describe('keystone.session.keystoneAuth()');

});