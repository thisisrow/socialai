const Context = require('../models/Context');

// Get context for a post
exports.getContext = async (req, res) => {
    try {
        const context = await Context.findOne({ postId: req.params.postId, user: req.user.id });
        if (!context) {
            return res.status(404).json({ success: false, error: 'Context not found' });
        }
        res.status(200).json({ success: true, data: context });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// Add context to a post
exports.addContext = async (req, res) => {
    try {
        const { postId, context } = req.body;
        const existingContext = await Context.findOne({ postId: postId, user: req.user.id });

        if (existingContext) {
            return res.status(400).json({ success: false, error: 'Context already exists for this post' });
        }

        const newContext = new Context({
            user: req.user.id,
            postId: postId,
            context
        });

        await newContext.save();
        res.status(201).json({ success: true, data: newContext });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// Update context for a post
exports.updateContext = async (req, res) => {
    try {
        const { context } = req.body;
        const updatedContext = await Context.findOneAndUpdate(
            { postId: req.params.postId, user: req.user.id },
            { context },
            { new: true, runValidators: true }
        );

        if (!updatedContext) {
            return res.status(404).json({ success: false, error: 'Context not found' });
        }

        res.status(200).json({ success: true, data: updatedContext });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// Delete context for a post
exports.deleteContext = async (req, res) => {
    try {
        const deletedContext = await Context.findOneAndDelete({ postId: req.params.postId, user: req.user.id });

        if (!deletedContext) {
            return res.status(404).json({ success: false, error: 'Context not found' });
        }

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};
