import RecordType from "./recordType.model.js";

export const getRecordTypes = async (req, res) => {
    try {
        const types = await RecordType.find({ isActive: true });
        res.json({ data: types });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const createRecordType = async (req, res) => {
    try {
        const { template, label, layout } = req.body;

        const existing = await RecordType.findOne({ template });
        if (existing) {
            return res.status(400).json({ message: "Record Type template already exists" });
        }

        const newType = await RecordType.create({
            template,
            label,
            layout: layout || []
        });

        res.status(201).json({ message: "Record Type Created", data: newType });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const updateRecordType = async (req, res) => {
    try {
        const { id } = req.params;
        const { label, layout, isActive } = req.body;

        const updatePayload = { label, layout, isActive };

        const updated = await RecordType.findByIdAndUpdate(
            id,
            updatePayload,
            { new: true }
        );

        if (!updated) return res.status(404).json({ message: "Record Type not found" });

        res.json({ message: "Record Type Updated", data: updated });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const deleteRecordType = async (req, res) => {
    try {
        const { id } = req.params;
        await RecordType.findByIdAndDelete(id);
        res.json({ message: "Record Type Deleted" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
