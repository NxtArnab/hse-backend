import InvestigationOption from "./investigationOption.model.js";

export const getInvestigationOptions = async (req, res) => {
  try {
    const { type, includeInactive } = req.query || {};

    const query = {};
    if (type) query.type = type;

    // For incident-create lookups by type, return only active options by default.
    if (!includeInactive && type) {
      query.isActive = true;
    }

    const options = await InvestigationOption.find(query).sort({ label: 1 });
    return res.json({ data: options });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const createInvestigationOption = async (req, res) => {
  try {
    const { type, label, isActive = true } = req.body || {};

    if (!type || !label) {
      return res.status(400).json({ message: "Type and label are required" });
    }

    const normalizedLabel = String(label).trim();
    if (!normalizedLabel) {
      return res.status(400).json({ message: "Label is required" });
    }

    const created = await InvestigationOption.create({
      type,
      label: normalizedLabel,
      labelLower: normalizedLabel.toLowerCase(),
      isActive,
    });

    return res.status(201).json({ message: "Investigation option created", data: created });
  } catch (error) {
    console.log(error);
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Option already exists for this type" });
    }
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateInvestigationOption = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, label, isActive } = req.body || {};

    const payload = {};
    if (typeof type === "string") payload.type = type;

    if (typeof label === "string") {
      const normalizedLabel = label.trim();
      if (!normalizedLabel) {
        return res.status(400).json({ message: "Label is required" });
      }
      payload.label = normalizedLabel;
      payload.labelLower = normalizedLabel.toLowerCase();
    }

    if (typeof isActive === "boolean") payload.isActive = isActive;

    const updated = await InvestigationOption.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Investigation option not found" });
    }

    return res.json({ message: "Investigation option updated", data: updated });
  } catch (error) {
    console.log(error);
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Option already exists for this type" });
    }
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteInvestigationOption = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await InvestigationOption.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Investigation option not found" });
    }

    return res.json({ message: "Investigation option deleted" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
