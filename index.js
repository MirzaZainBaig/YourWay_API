const express = require("express");
const { JWT } = require("google-auth-library");
const nodemailer = require("nodemailer");
const { makeId, fullDate } = require("./Helper");
const axios = require("axios");
const moment = require("moment");
const stripe = require("stripe")(
  "sk_test_51PCVKwJ9FrBfnAt0LGbstkSwrq1qO6yIHpyVWGosIuWfDNL5z5wmL28sF2z0wyuigp77ku78W9nebSd8Q5B0Pz8v002Fv3Ow84" ////zippy testing Keys
);

const admin = require("firebase-admin");
const serviceAccount = require("./yourway-services.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();
const app = express();
app.use(express.json());

let otpStore = {};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "yourwayapp0@gmail.com",
    pass: "qily tomb miwr onrb",
  },
});
const SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"];
const client = new JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: SCOPES,
});

async function getAccessToken() {
  const tokens = await client.authorize();
  return tokens.access_token;
}

async function sendPushNotificationHandler(payload) {
  try {
    const accessToken = await getAccessToken();
    const urlForApiCall =
      "https://fcm.googleapis.com/v1/projects/your-way-4a120/messages:send";
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; UTF-8",
    };
    const response = await axios.post(urlForApiCall, payload, { headers });
    return response.data;
  } catch (error) {
    return {
      error: "Failed to send push notification",
      details: error.message,
    };
  }
}

app.post("/sendPushNotification", async (req, res) => {
  const body = req.body;
  const result = await sendPushNotificationHandler(body);
  console.log("sendPushNotification------>", result);
  if (result.error) {
    return res.status(500).json(result);
  }
  res.status(200).json({ message: "Push notification sent", result });
});

app.post("/sendOtp", (req, res) => {
  const { recipientEmail } = req.body;
  if (!recipientEmail) {
    return res.status(400).json({ error: "Recipient email is required." });
  }
  const OTP = Math.floor(1000 + Math.random() * 9000).toString();
  otpStore[recipientEmail] = OTP;
  const mailOptions = {
    from: "yourwayapp0@gmail.com",
    to: recipientEmail,
    subject: "OTP Verification",
    html: `<h3>Your Verification Code is: ${OTP}</h3>`,
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res
        .status(500)
        .json({ error: "Failed to send email", details: error.message });
    }
    res
      .status(200)
      .json({ message: "OTP sent successfully", messageId: info.messageId });
  });
});

app.post("/verifyOtp", (req, res) => {
  const { recipientEmail, OTP } = req.body;
  if (!recipientEmail || !OTP) {
    return res.status(400).json({ error: "Email and OTP are required." });
  }
  const storedOTP = otpStore[recipientEmail];
  if (storedOTP && storedOTP === OTP) {
    delete otpStore[recipientEmail];
    return res
      .status(200)
      .json({ status: true, message: "OTP verified successfully." });
  }

  return res
    .status(400)
    .json({ status: false, message: "Invalid or expired OTP." });
});

app.post("/sendMail", async (req, res) => {
  const body = req.body;
  try {
    const info = await sendMailHandler(body);
    return res
      .status(200)
      .json({ message: "Email sent successfully", messageId: info.messageId });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to send email", details: error.message });
  }
});

async function sendMailHandler(data) {
  function htmlMail(body) {
    let message;
    const bidChangeStatus = body.type.includes("Bid");
    const changeJobStatus = body.type.includes("Job");

    const styles = `
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 20px;
        }
        .container {
          background-color: #ffffff;
          border-radius: 5px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        h3 {
          color: #333;
        }
        p {
          color: #555;
          line-height: 1.5;
        }
        .footer {
          margin-top: 20px;
          font-size: 0.9em;
          color: #888;
        }
      </style>
    `;
    if (bidChangeStatus) {
      message = `
        <div class="container">
          <p>Dear ${body.recieverName},</p>
          <p>We are need to inform you that the job titled <strong>${body?.jobtitle}</strong>, which involved ${body?.description}, has ${body?.status}.</p>
           <h3>Job Details:</h3>
          <p>
              <strong>Job Description:</strong> ${body?.description}<br>
              <strong>Deadline:</strong> ${body.deadline}<br>
          </p>
        <p>We understand that this may not be the outcome you were hoping for, and we encourage you to consider creating a new job post in the future.</p>
        <p>Thank you for using our platform, and we appreciate your continued trust in us for your task management needs.</p>
          <p class="footer">Thank you for your continued partnership!<br>Your Way App<br></p>
        </div>
      `;
    } else if (changeJobStatus) {
      message = `
        <div class="container">
          <p>Dear ${body.recieverName},</p>
          <p>We are need to inform you that you have been assigned a new job titled <strong>${body?.jobtitle}</strong>. This job involves ${body.description}.</p>
          <p>The job has been assigned to you on <strong>${body?.assigningDate}</strong>, and we expect it to be completed by <strong>${body.deadline}</strong>.</p>
          <p>Please take some time to review the job details carefully. If you encounter any questions or require further clarification, do not hesitate to reach out to us. We are here to support you and ensure you have everything you need to succeed in this assignment.</p>
          <p>Thank you for your attention, and we appreciate your hard work and dedication!</p>
  
          <p class="footer">Best regards,<br>Your Way App<br></p>
        </div>
      `;
    }
    return `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Job Status</title>
            ${styles} <!-- Include the styles here -->
          </head>
          <body>
            ${message}
          </body>
          </html>
    `;
  }

  const mailOptions = {
    from: "yourwayapp0@gmail.com",
    to: data.recipientEmail,
    subject: data.subject,
    text: "",
    html: htmlMail(data.body),
  };
  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return reject(new Error(`Failed to send email: ${error.message}`));
      }
      resolve(info);
    });
  });
}

////////////////////////--------->

const stripePublishKey_test =
  "pk_test_51PCVKwJ9FrBfnAt0efqGTZUSWfsEguHvpFprw0EoKkGf4YjGStCJXaFi7jNfnW5cxgIERu3uu0CXzv2lCLFjp88R00tPrzgyBb"; ////zippy testing Keys

// Handle Stripe webhook events
app.post("/webhook", async (req, res) => {
  const event = req.body;
  try {
    switch (event.type) {
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.send({ received: true });
  } catch (error) {
    console.error("Error handling webhook event:", error);
    res.status(500).send("Webhook Error");
  }
});

app.post("/subscription", async (req, res) => {
  const email = req.body.email;
  const card = req.body.card;
  const customerID = await createCustomerId(email);
  const resp = await createAndAttachPaymentMethod(customerID, card);
  const product = await createProductAndPrice();
  let subscriptionBody = {
    customerId: customerID,
    priceId: product.priceId,
  };
  const subscription = await createSubscription(subscriptionBody);
  const subscriptionStatus = await stripe.subscriptions.retrieve(
    subscription.subscriptionId
  );
  const endDate = new Date(subscriptionStatus.current_period_end * 1000);
  const startDate = new Date(subscriptionStatus.current_period_start * 1000);

  res.send({
    status: "active",
    Start_Date: startDate,
    End_Date: endDate,
    subscriptionId: subscription.subscriptionId,
    paymentMethodId: resp?.paymentMethodId,
    cardId: resp?.cardId,
    cardToken: resp?.cardToken,
  });
});

app.post("/cancel-subscription", async (req, res) => {
  const { subscriptionId } = req.body;
  try {
    const subscription = await stripe.subscriptions.del(subscriptionId);
    res.send(subscription);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

app.get("/check-subscription", async (req, res) => {
  try {
    const subscriptionId = req.query.id;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    res.json(subscription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/renew-subscription", async (req, res) => {
  const { subscriptionId } = req.body;
  try {
    const currentSubscription = await stripe.subscriptions.retrieve(
      subscriptionId
    );
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    const newSubscription = await stripe.subscriptions.create({
      customer: currentSubscription.customer,
      items: [
        {
          price: currentSubscription.items.data[0].price.id,
        },
      ],
      expand: ["latest_invoice.payment_intent"],
    });

    const subscriptionStatus = await stripe.subscriptions.retrieve(
      newSubscription.id
    );
    const endDate = new Date(subscriptionStatus.current_period_end * 1000);
    const startDate = new Date(subscriptionStatus.current_period_start * 1000);
    res.send({
      status: "active",
      Start_Date: startDate,
      End_Date: endDate,
      subscriptionId: newSubscription.id,
    });
  } catch (error) {
    console.error("Error renewing subscription:", error);
    res.status(400).send({ error: error.message });
  }
});

// Handle subscription updated event
const handleSubscriptionUpdated = async (subscription) => {
  await firestore
    .collection("subscriptions")
    .doc(subscription.customer)
    .update({
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    });
};

// Handle subscription deleted event
const handleSubscriptionDeleted = async (subscription) => {
  await firestore
    .collection("subscriptions")
    .doc(subscription.customer)
    .update({
      status: "canceled",
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    });
};

// Handle payment failed event
const handlePaymentFailed = async (invoice) => {
  await firestore
    .collection("subscriptions")
    .doc(invoice.customer)
    .update({
      status: "past_due",
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    });
};

const createCustomerId = async (email) => {
  try {
    const customer = await stripe.customers.create({
      email: email,
    });
    return customer.id;
  } catch (error) {
    console.error("Error creating customer:", error);
    throw error;
  }
};

const createProductAndPrice = async () => {
  try {
    const product = await stripe.products.create({
      name: "Monthly Subscription",
      description:
        "A monthly subscription plan provides access to a service or product for a recurring monthly fee. Each billing cycle, the subscriber is charged automatically, ensuring uninterrupted access throughout the subscription period.",
    });

    const price = await stripe.prices.create({
      unit_amount: "20" * 100,
      currency: "usd",
      product: product.id,
      recurring: {
        interval: "month",
      },
    });

    return {
      productId: product.id,
      priceId: price.id,
    };
  } catch (error) {
    console.error("Error creating product and price:", error);
    throw error;
  }
};

const createSubscription = async (body) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: body.customerId,
      items: [{ price: body.priceId }],
      expand: ["latest_invoice.payment_intent"],
    });

    return {
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      status: subscription.status,
    };
  } catch (e) {}
};

const createAndAttachPaymentMethod = async (customerId, card) => {
  try {
    const resp = orderCardValues(card);
    const token = await generateCustomerTokenReq(resp);
    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      "card[token]": token.token,
    });
    await attachPaymentMethod(customerId, paymentMethod.id);
    return {
      paymentMethodId: paymentMethod.id,
      cardToken: token?.token,
      cardId: token.cardId,
    };
  } catch (error) {
    console.error("Error creating and attaching payment method:", error);
    throw error;
  }
};

const orderCardValues = (selectedCard) => {
  const splitDate = selectedCard?.expiration.split("/");
  return {
    "card[number]": selectedCard?.number,
    "card[exp_month]": splitDate[0],
    "card[exp_year]": splitDate[1],
    "card[cvc]": selectedCard.cvv,
  };
};

const generateCustomerTokenReq = async (body) => {
  try {
    const response = await fetch("https://api.stripe.com/v1/tokens", {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${stripePublishKey_test}`,
      },
      method: "post",
      body: Object.keys(body)
        .map((key) => key + "=" + body[key])
        .join("&"),
    });

    const responseData = await response.json();
    return { token: responseData?.id, cardId: responseData?.card?.id };
  } catch (error) {
    onComplete(null);
    throw error; // Rethrow the error for proper error handling
  }
};

const attachPaymentMethod = async (customerId, paymentMethodId) => {
  try {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  } catch (error) {
    console.error("Error attaching payment method:", error);
    throw error;
  }
};

/////////////////////////////////

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

////////////////////////  Deadline Handler

const sendPushNotificationReq = async (params) => {
  const queryshot = await db.collection("Users").doc(params?.userId).get();
  let userDetail = queryshot?.data();
  if (userDetail?.fcmToken) {
    let pushNotificationBody = {
      message: {
        token: userDetail?.fcmToken,
        notification: {
          body: params?.body,
          title: params?.title,
        },
        data: {
          notificationType: params?.notificationType,
          jobId: params?.jobId || "",
          bidId: params?.bidId || "",
        },
      },
    };
    await sendPushNotificationHandler(pushNotificationBody);
  }
  return;
};

const updateNotificationList = async (userId, notification) => {
  const docs = await db.collection("Notification_Collection").doc(userId).get();
  let previousNotificationList = docs?._data?.notification_List
    ? docs?._data?.notification_List
    : [];
  const updatedNotification = {
    ...notification,
    notificationId: makeId(6),
    createdAt: moment.utc(new Date()).format(fullDate),
  };
  const completeNotiList = [...previousNotificationList, updatedNotification];
  const docRef = db.collection("Notification_Collection").doc(userId);

  if (previousNotificationList?.length > 0) {
    docRef.update({ notification_List: completeNotiList });
  } else {
    docRef.set({ userId, notification_List: completeNotiList });
  }
};

async function deadlineHandler() {
  try {
    const jobRef = db.collection("JOBS");
    const updateJobStatus = async (jobData, status, bidOwnerDetail = null) => {
      await jobRef.doc(jobData.jobId).update({
        jobStatus: status,
        jobId: jobData.jobId,
        bidOwnerDetail,
      });

      const otherUserObj = bidOwnerDetail;
      const currentUserObj = { ...jobData?.jobOwnerDetail };
      const statusAccepted = status === "Accepted";
      const notificationTitle = statusAccepted
        ? "Bid Accepted"
        : `Job ${status}`;
      if (statusAccepted) {
        let notificationBody = `${currentUserObj?.name} ${status} Your Bid #${bidOwnerDetail?.bidId} against Job ${jobData?.jobTitle}`;
        const otherUserNotificationObj = {
          reciever: otherUserObj,
          sender: currentUserObj,
          notificationType: "Bid Status Changed",
          title: notificationTitle,
          body: notificationBody,
          jobId: jobData?.jobId,
          bidId: bidOwnerDetail?.bidId,
        };

        const pushObj = {
          userId: otherUserObj?.userId,
          title: notificationTitle,
          body: notificationBody,
          jobId: jobData?.jobId,
          notificationType: "Bid Status Changed",
          bidId: bidOwnerDetail?.bidId,
        };

        const emailObj = {
          recipientEmail: otherUserObj?.email,
          subject: notificationTitle,
          body: {
            type: statusAccepted ? "Job" : "Bid",
            recieverName: otherUserObj?.name,
            jobtitle: jobData?.jobTitle,
            description: jobData?.description,
            status: status,
            assigningDate: formatDate(new Date()),
            deadline: formatDate(new Date(jobData?.deadLine)),
          },
        };

        await updateNotificationList(
          otherUserObj?.userId,
          otherUserNotificationObj
        );
        await sendMailHandler(emailObj);
        await sendPushNotificationReq(pushObj);

        //send push and Email to other user--here----->
        notificationBody = `You ${status} Bid #${bidOwnerDetail?.bidId} against Job ${jobData?.jobTitle}`;

        const currentUserNotificationObj = {
          reciever: currentUserObj,
          sender: otherUserObj,
          notificationType: "Bid Status Changed",
          title: notificationTitle,
          body: notificationBody,
          jobId: jobData?.jobId,
          bidId: bidOwnerDetail?.bidId,
        };

        const pushCurrentUserObj = {
          userId: currentUserObj?.userId,
          title: notificationTitle,
          body: notificationBody,
          jobId: jobData?.jobId,
          notificationType: "Bid Status Changed",
          bidId: bidOwnerDetail?.bidId,
        };
        const emailCurrentUserObj = {
          recipientEmail: currentUserObj?.email,
          subject: notificationTitle,
          body: {
            type: statusAccepted ? "Job" : "Bid",
            recieverName: currentUserObj?.name,
            jobtitle: jobData?.jobTitle,
            description: jobData?.description,
            status: status,
            assigningDate: formatDate(new Date()),
            deadline: formatDate(new Date(jobData?.deadLine)),
          },
        };

        await updateNotificationList(
          currentUserObj?.userId,
          currentUserNotificationObj
        );
        await sendMailHandler(emailCurrentUserObj);
        await sendPushNotificationReq(pushCurrentUserObj);
        //send push and Email to other user--here----->
      } else {
        notificationBody = `You Job:${jobData?.jobTitle} is ${status}`;

        const currentUserNotificationObj = {
          reciever: currentUserObj,
          sender: otherUserObj,
          notificationType: "Bid Status Changed",
          title: notificationTitle,
          body: notificationBody,
          jobId: jobData?.jobId,
          bidId: bidOwnerDetail?.bidId,
        };

        const pushCurrentUserObj = {
          userId: currentUserObj?.userId,
          title: notificationTitle,
          body: notificationBody,
          jobId: jobData?.jobId,
          notificationType: "Job Status",
          bidId: bidOwnerDetail?.bidId,
        };
        const emailCurrentUserObj = {
          recipientEmail: currentUserObj?.email,
          subject: notificationTitle,
          body: {
            type: "Job",
            recieverName: currentUserObj?.name,
            jobtitle: jobData?.jobTitle,
            description: jobData?.description,
            status: status,
            assigningDate: formatDate(new Date()),
            deadline: formatDate(new Date(jobData?.deadLine)),
          },
        };

        await updateNotificationList(
          currentUserObj?.userId,
          currentUserNotificationObj
        );
        await sendMailHandler(emailCurrentUserObj);
        await sendPushNotificationReq(pushCurrentUserObj);

        //send push and Email to other user--here----->
      }
    };

    const fetchUserDetail = async (userId) => {
      try {
        const doc = await admin
          .firestore()
          .collection("Users")
          .doc(userId)
          .get();
        return { status: true, data: doc.data() };
      } catch {
        return { status: false, data: null };
      }
    };

    const formatDate = (date) => {
      const pad = (num) => String(num).padStart(2, "0");
      return `${pad(date.getDate())}-${pad(
        date.getMonth() + 1
      )}-${date.getFullYear()} ${pad(date.getHours())}:${pad(
        date.getMinutes()
      )}`;
    };

    const processBids = async (jobData, jobId) => {
      if (jobData?.jobId !== jobId) {
        return;
      }
      const bidsSnapshot = await jobRef
        .doc(jobData.jobId)
        .collection("BIDs")
        .get();
      const bids = bidsSnapshot.docs.map((doc) => doc.data());
      if (bids.length > 0) {
        const maxPrice = Math.max(...bids.map((bid) => parseFloat(bid.price)));
        const maxPriceUsers = bids.filter(
          (bid) => parseFloat(bid.price) === maxPrice
        );
        const assignedBidder =
          maxPriceUsers.sort((a, b) => a.createdAt - b.createdAt)[0] ||
          maxPriceUsers[0];
        if (assignedBidder) {
          const bidOwnerDetail = {
            ...assignedBidder.senderDetail,
            bidId: assignedBidder.bidId,
          };
          await jobRef
            .doc(jobData.jobId)
            .collection("BIDs")
            .doc(bidOwnerDetail.bidId)
            .update({ bidStatus: "Accepted" });
          await updateJobStatus(jobData, "Accepted", bidOwnerDetail);
        } else {
          await expireJob(jobData);
        }
      } else {
        await expireJob(jobData);
      }
    };

    const expireJob = async (jobData) => {
      await updateJobStatus(jobData, "Expired");
      const jobOwner = await fetchUserDetail(jobData.jobOwnerDetail.userId);

      if (jobOwner.status) {
        await sendMailHandler({
          recipientEmail: jobOwner.data.email,
          subject: `Job Expired: ${jobData.jobTitle}`,
          body: {
            status: "Job expired",
            type: "Job",
            recieverName:
              jobOwner.data.fullName ||
              `${jobOwner.data.firstName} ${jobOwner.data.lastName}`,
            jobtitle: jobData.jobTitle,
            jobdescription: jobOwner.data.description,
            deadline: formatDate(new Date(jobOwner.data.deadLine)),
            assigningData: jobOwner.data?.createdAt,
          },
        });
      }
    };

    jobRef.onSnapshot(
      (snapshot) => {
        if (!snapshot.empty) {
          snapshot.forEach(async (doc) => {
            const data = doc.data();
            const jobId = data.jobId;
            const deadline = data.deadLine;
            const jobStatus = data.jobStatus;
            if (deadline && jobStatus === "Pending") {
              const deadlineTime = new Date(deadline).getTime();
              const currentTime = Date.now();
              const delay = deadlineTime - currentTime;
              if (delay > 0) {
                setTimeout(async () => {
                  await processBids(data, jobId);
                }, delay);
              }
            }
          });
        }
      },
      (err) => {
        console.error("Error listening for real-time updates:", err);
      }
    );
  } catch (error) {
    console.error("Error retrieving documents:", error);
  }
}

deadlineHandler();

app.post("/", (req, res) => {
  res.send("working ----");
});
