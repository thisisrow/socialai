const Context = require('../models/Context');
const User = require('../models/User');
const axios = require('axios');

const verifyWebhook = async (req, res) => {
    const VERIFY_TOKEN = "my_verify_token"; // <- set same as in FB developer console
  
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
  
    if (mode && token) {
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    }
  };

const handleWebhook =async (req, res) => {
//     try {
//       const body = req.body;
  
//       if (body.object === "instagram") {
//         body.entry.forEach(async (entry) => {
//           const igUserId = entry.id; // Instagram User ID
//           const changes = entry.changes;
  
//           for (const change of changes) {
//             if (change.field === "comments") {
//               const postId = change.value.media.id;
//               const commentText = change.value.text;
//               const commenterId = change.value.from.id;
  
//               console.log(`New comment on post ${postId}: ${commentText}`);
  
//               // Store comment context in DB
//               const context = new Context({
//                 user: null, // you can link to your User by igUserId if needed
//                 postId: postId,
//                 context: commentText,
//                 automation: true,
//               });
//               await context.save();
//             }
//           }
//         });
//         res.sendStatus(200);
//       } else {
//         res.sendStatus(404);
//       }
//     } catch (err) {
//       console.error("Webhook error:", err);
//       res.sendStatus(500);
//     }
  };

module.exports = {
    verifyWebhook,
    handleWebhook
};
