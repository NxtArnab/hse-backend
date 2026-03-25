import RecordType from "./recordType.model.js";

export const getRecordTypes = async (req, res) => {
    try {
        const types = await RecordType.find({ isActive: true }).sort({ createdAt: -1 });
        res.json({ data: types });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const createRecordType = async (req, res) => {
    try {
        const { label, template, layout = [] } = req.body || {};

        if (!label || !template) {
            return res.status(400).json({ message: "Label and template are required" });
        }

        const normalizedTemplate = String(template).trim().toLowerCase();
        const existing = await RecordType.findOne({ template: normalizedTemplate });
        if (existing) {
            return res.status(409).json({ message: "Template key already exists" });
        }

        const created = await RecordType.create({
            label: String(label).trim(),
            template: normalizedTemplate,
            layout,
            isActive: true,
        });

        res.status(201).json({ message: "Record type created", data: created });
    } catch (error) {
        console.log(error);
        if (error?.code === 11000) {
            return res.status(409).json({ message: "Template key already exists" });
        }
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const updateRecordType = async (req, res) => {
    try {
        const { id } = req.params;
        const { label, layout, isActive } = req.body || {};

        const payload = {};
        if (typeof label === "string") payload.label = label.trim();
        if (Array.isArray(layout)) payload.layout = layout;
        if (typeof isActive === "boolean") payload.isActive = isActive;

        const updated = await RecordType.findByIdAndUpdate(id, payload, {
            new: true,
            runValidators: true,
        });

        if (!updated) {
            return res.status(404).json({ message: "Record type not found" });
        }

        res.json({ message: "Record type updated", data: updated });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const deleteRecordType = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await RecordType.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ message: "Record type not found" });
        }

        res.json({ message: "Record type deleted" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
