/**
 * A small Express.js web server for handling payments from the bridge server.
 */

var express = require('express');
var bodyParser = require('body-parser');

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/receive', function (request, response) {
  var payment = request.body;

  // `receive` may be called multiple times for the same payment, so check that
  // you haven't already seen this payment ID.
  if (getPaymentByIdFromDb(payment.id)) {
    return response.status(200).end();
  }

  // Because we have one Stellar account representing many customers, the
  // customer the payment is intended for should be in the transaction memo.
  var customer = getAccountFromDb(payment.memo);

  // You need to check the asset code and issuer to make sure it's an asset
  // that you can accept payment to this account for. In this example, we just
  // convert the amount to USD and adding the equivalent amount to the customer
  // balance. You need to implement `convertToUsd()` yourself.
  var dollarAmount = convertToUsd(
    payment.amount, payment.asset_code, payment.asset_issuer);
  addToBankAccountBalance(customer, dollarAmount);
  response.status(200).end();
  console.log('Added ' + dollarAmount + ' USD to account: ' + customer);
});

app.post('/compliance/fetch_info', function (request, response) {
  var addressParts = response.body.address.split('*');
  var friendlyId = addressParts[0];

  // You need to create `accountDatabase.findByFriendlyId()`. It should look
  // up a customer by their Stellar account and return account information.
  accountDatabase.findByFriendlyId(friendlyId)
    .then(function(account) {
      // This can be any data you determine is useful and is not limited to
      // these three fields.
      response.json({
        name: account.fullName,
        address: account.address,
        date_of_birth: account.dateOfBirth
      });
      response.end();
    })
    .catch(function(error) {
      console.error('Fetch Info Error:', error);
      response.status(500).end(error.message);
    });
});

app.post('/compliance/sanctions', function (request, response) {
  var sender = JSON.parse(request.body.sender);

  // You need to create a function to check whether there are any sanctions
  // against someone.
  sanctionsDatabase.isAllowed(sender)
    .then(function() {
      response.status(200).end();
    })
    .catch(function(error) {
      // In this example, we're assuming `isAllowed` returns an error with a
      // `type` property that indicates the kind of error. Your systems may
      // work differently; just return the same HTTP status codes.
      if (error.type === 'DENIED') {
        response.status(403).end();
      }
      else if (error.type === 'UNKNOWN') {
        // If you need to wait and perform manual checks, you'll have to
        // create a way to do that as well
        notifyHumanForManualSanctionsCheck(sender);
        // The value for `pending` is a time to check back again in seconds
        response.status(202).json({pending: 3600}).end();
      }
      else {
        response.status(500).end(error.message);
      }
    });
});

app.post('/compliance/ask_user', function (request, response) {
  var sender = JSON.parse(request.body.sender);

  // You can do any checks that make sense here. For example, you may not
  // want to share information with someone who has sanctions as above:
  sanctionsDatabase.isAllowed(sender)
    .then(function() {
      response.status(200).end();
    })
    .catch(function(error) {
      if (error.type === 'UNKNOWN') {
        // If you need to wait and perform manual checks, you'll have to
        // create a way to do that as well.
        notifyHumanForManualInformationSharing(sender);
        // The value for `pending` is a time to check back again in seconds
        response.status(202).json({pending: 3600}).end();
      }
      else {
        response.status(403).end();
      }
    });
});

app.listen(8005, function () {
  console.log('Bridge server callbacks running on port 8005!');
});
