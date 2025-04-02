var http = require("http"),
  fs = require("fs"),
  ccav = require("../utils/ccavutil.js"),
  qs = require("querystring");
const dotenv = require("dotenv");
const Order = require("../models/Order");
const User = require("../models/user.js");
const { clerk } = require("../middlewares/auth.middleware.js");

dotenv.config();

const {
  ProductEmailTemplate,
  SubscriptionEmailTemplate,
  // AssessementReportEmailTemplate,
  // ConsultanyBookingemailTemplate,
} = require("../utils/templates/email-template.js");

const { sendEmail } = require("../services/emailService.js");

const postRes = async (request, response) => {
  console.log("Received CCAvenue response");
  const userId = request.query?.userId;

  console.log("userId got : ===========>", userId);

  let rawString = "";
  if (Buffer.isBuffer(request.body)) {
    rawString = request.body.toString();
  } else if (typeof request.body === "object") {
    rawString = qs.stringify(request.body);
  } else {
    rawString = request.body;
  }

  const parsedData = qs.parse(rawString);
  console.log("Parsed request data:", parsedData);

  var ccavEncResponse = parsedData.encResp,
    workingKey = `${process.env.CCAVENUE_WORKING_KEY}`;
  console.log("Starting CCAvenue response processing.");

  console.log("going to next one");
  try {
    const decryptedResponse = ccav.decrypt(ccavEncResponse, workingKey);
    console.log("Decrypted Response:", decryptedResponse);

    // Convert the response string to an object
    const responseObject = decryptedResponse.split("&").reduce((acc, pair) => {
      const [key, value] = pair.split("=");
      acc[key] = decodeURIComponent(value || "");
      return acc;
    }, {});

    console.log("CCAvenue Response:", responseObject);
    const subscriptionType = responseObject.merchant_param3 || null;

    if (responseObject.order_id) {
      try {
        const orderStatus =
          responseObject.order_status?.toUpperCase() || "UNKNOWN";
        const orderUpdate = await Order.findOneAndUpdate(
          { orderId: responseObject.order_id },
          {
            status: orderStatus?.toUpperCase(),
            paymentId: responseObject.tracking_id || null,
            bankRefNumber: responseObject.bank_ref_no || null,
            paymentMethod: responseObject.payment_mode || null,
            updatedAt: new Date(),
            paymentResponse: JSON.stringify(responseObject),
          }
        );

        console.log("Order update result:", orderUpdate);

        console.log(
          `Order ${responseObject.order_id} updated with status: ${orderStatus}`
        );

        const type = subscriptionType?.toLowerCase() || "";

        console.log("here you can send the product to the user");
        const order = await Order.findOne({
          orderId: responseObject.order_id,
        })
          .populate("products")
          .populate("user");

        console.log("order user found is =====================>", order.user);

        if (order && order.user && order.user.email) {
          try {
            if (type === "platinum" || type === "prime") {
              console.log(
                "Membership subscription detected:",
                subscriptionType
              );

              const validUntil = new Date();
              validUntil.setFullYear(validUntil.getFullYear() + 1);

              const updatedUser = await User.findOneAndUpdate(
                { clerkId: userId },
                {
                  "subscription.plan": subscriptionType.toLowerCase(),
                  "subscription.status": "active",
                  "subscription.startDate": new Date(),
                  "subscription.validUntil": validUntil,
                },
                { new: true }
              );

              console.log("User subscription updated:", updatedUser);

              const subscriptionData = {
                plan: type,
                status: "active",
                startDate: new Date().toISOString(),
                validUntil,
              };
              await clerk.users.updateUser(userId, {
                publicMetadata: {
                  subscriptionData,
                },
              });

              const updatedUserInClerk = await clerk.users.getUser(userId);

              console.log(
                "Updated Clerk User Metadata:",
                updatedUserInClerk.publicMetadata
              );
            }
            switch (order.order_type) {
              case "product_purchase":
                const productMailInfo = {
                  from: process.env.EMAIL_USER,
                  // to: order.user.email,
                  to: order.email,
                  subject: "Thank for your purchase",
                  html: ProductEmailTemplate(order),
                };
                const productEmailResponse = await sendEmail(productMailInfo);
                if (productEmailResponse.success) {
                  console.log("EmailServiceResponse", productEmailResponse);
                  console.log(`Product access email sent to ${order.email}`);
                }
                break;
              case "subscription_purchase":
                const subscriptionMailInfo = {
                  from: process.env.EMAIL_USER,
                  // to: order.user.email,
                  to: order.email,
                  subject: "Thank you for purchasing Mentoons Subscription",
                  html: SubscriptionEmailTemplate(order),
                };
                const subscriptionEmailResponse = await sendEmail(
                  subscriptionMailInfo
                );
                if (subscriptionEmailResponse.success) {
                  console.log(
                    "Subscription email resonse ",
                    subscriptionEmailResponse
                  );
                }
                break;

              default:
                break;
            }
          } catch (emailError) {
            console.error(`Error Sending Email`, emailError);
          }
        } else {
          console.log(
            "Unable to send email: Missing order details or user email"
          );
        }
      } catch (dbError) {
        console.error("Database update error:", dbError);
      }
    }

    // Redirect to frontend with payment status
    const redirectUrl = new URL(process.env.FRONTEND_URL + "/payment-status");
    redirectUrl.searchParams.append(
      "status",
      responseObject.order_status || "UNKNOWN"
    );
    redirectUrl.searchParams.append("orderId", responseObject.order_id || "");
    redirectUrl.searchParams.append(
      "trackingId",
      responseObject.tracking_id || ""
    );

    if (subscriptionType) {
      redirectUrl.searchParams.append(
        "subscription",
        subscriptionType.toLowerCase()
      );
    }

    if (responseObject.order_status === "Success") {
      redirectUrl.searchParams.append("message", "Payment Successful");
    } else if (responseObject.order_status === "Aborted") {
      redirectUrl.searchParams.append("message", "Payment Aborted");
    } else if (responseObject.order_status === "Failure") {
      redirectUrl.searchParams.append("message", "Payment Failed");
    } else {
      redirectUrl.searchParams.append("message", "Payment Status Unknown");
    }

    // Log the complete URL information
    console.log("Redirect URL object:", redirectUrl);
    console.log("Redirect URL string:", redirectUrl.toString());
    console.log("URL search parameters:");
    redirectUrl.searchParams.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    response.writeHeader(302, {
      Location: redirectUrl.toString(),
    });
    response.end();
  } catch (error) {
    console.error("CCAvenue response error:", error);

    // Redirect to frontend with error
    const redirectUrl = new URL(process.env.FRONTEND_URL + "/payment-status");
    redirectUrl.searchParams.append("status", "ERROR");
    redirectUrl.searchParams.append(
      "message",
      "Failed to process payment response"
    );

    response.writeHeader(302, {
      Location: redirectUrl.toString(),
    });
    response.end();
  }
};

module.exports = { postRes };
