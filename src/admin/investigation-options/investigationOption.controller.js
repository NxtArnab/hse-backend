import InvestigationOption from "./investigationOption.model.js";

const VALID_TYPES = ["condition", "behaviour"];
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getInvestigationOptions = async (req, res) => {
  try {
    const { type } = req.query;
    const query = { isActive: true };

    if (type) {
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({ message: "Invalid type. Use condition or behaviour." });
      }
      query.type = type;
    }

    const options = await InvestigationOption.find(query).sort({ label: 1, createdAt: -1 });
    res.status(200).json({ data: options });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const createInvestigationOption = async (req, res) => {
  try {
    const { type, label, isActive } = req.body;

    const normalizedType = String(type || "").trim().toLowerCase();
    const normalizedLabel = String(label || "").trim();

    if (!VALID_TYPES.includes(normalizedType)) {
      return res.status(400).json({ message: "Type is required and must be condition or behaviour" });
    }

    if (!normalizedLabel) {
      return res.status(400).json({ message: "Label is required" });
    }

    const existing = await InvestigationOption.findOne({
      type: normalizedType,
      label: { $regex: `^${escapeRegex(normalizedLabel)}$`, $options: "i" },
    });

    if (existing) {
      return res.status(400).json({ message: "Option already exists for this type" });
    }

    const option = await InvestigationOption.create({
      type: normalizedType,
      label: normalizedLabel,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    res.status(201).json({ message: "Option created successfully", data: option });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: "Option already exists for this type" });
    }
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateInvestigationOption = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, label, isActive } = req.body;

    const existingOption = await InvestigationOption.findById(id);
    if (!existingOption) {
      return res.status(404).json({ message: "Option not found" });
    }

    const nextType = type ? String(type).trim().toLowerCase() : existingOption.type;
    const nextLabel = label ? String(label).trim() : existingOption.label;

    if (!VALID_TYPES.includes(nextType)) {
      return res.status(400).json({ message: "Type must be condition or behaviour" });
    }

    if (!nextLabel) {
      return res.status(400).json({ message: "Label is required" });
    }

    const duplicate = await InvestigationOption.findOne({
      _id: { $ne: id },
      type: nextType,
      label: { $regex: `^${escapeRegex(nextLabel)}$`, $options: "i" },
    });

    if (duplicate) {
      return res.status(400).json({ message: "Option already exists for this type" });
    }

    const updated = await InvestigationOption.findByIdAndUpdate(
      id,
      {
        type: nextType,
        label: nextLabel,
        ...(typeof isActive === "boolean" ? { isActive } : {}),
      },
      { new: true }
    );

    res.status(200).json({ message: "Option updated successfully", data: updated });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: "Option already exists for this type" });
    }
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteInvestigationOption = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await InvestigationOption.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Option not found" });
    }

    res.status(200).json({ message: "Option deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
