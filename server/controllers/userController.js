const AppUser = require("../models/AppUser");
const IgAccount = require("../models/IgAccount");

exports.getMe = async (req, res) => {
    console.log(`GET /api/me called for user: ${req.appUserId}`);
    const user = await AppUser.findById(req.appUserId).lean();
    if (!user) {
        console.log("GET /api/me: user not found.");
        return res.status(404).json({ error: "user not found" });
    }
    const ig = await IgAccount.findOne({ appUserId: user._id }).lean();
    console.log(`GET /api/me: Found user. Instagram connected: ${!!ig}`);
    return res.json({
        ok: true,
        user: { id: String(user._id), email: user.email },
        instagramConnected: !!ig,
        basicUserId: ig?.basicUserId || null,
        igBusinessId: ig?.igBusinessId || null,
    });
};
