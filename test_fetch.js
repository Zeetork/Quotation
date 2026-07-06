require("dotenv").config({path: ".env.local"});
const axios = require("axios");

async function run() {
  try {
    const res = await axios.post("https://accounts.zoho.com/oauth/v2/token", null, {
      params: {
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: "refresh_token",
      }
    });
    
    const token = res.data.access_token;
    
    // fetch an estimate
    const fRes = await axios.get("https://www.zohoapis.com/books/v3/estimates?organization_id=" + process.env.ZOHO_ORGANIZATION_ID, {
      headers: { Authorization: "Zoho-oauthtoken " + token }
    });
    
    const estimateId = fRes.data.estimates[0].estimate_id;
    
    const sRes = await axios.get("https://www.zohoapis.com/books/v3/estimates/" + estimateId + "?organization_id=" + process.env.ZOHO_ORGANIZATION_ID, {
      headers: { Authorization: "Zoho-oauthtoken " + token }
    });
    
    console.log("FULL ESTIMATE:", JSON.stringify(sRes.data.estimate, null, 2));
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
run();
