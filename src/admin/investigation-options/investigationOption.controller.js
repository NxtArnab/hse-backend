import InvestigationOption from "./investigationOption.model.js";

const VALID_TYPES = ["condition", "behaviour"];

const normalizeType = (value) => String(value || "").trim().toLowerCase();

const normalizeValues = (values) => {
  const source = Array.isArray(values) ? values : [values];
  const deduped = new Map();

  source.forEach((value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, normalized);
    }
  });

  return Array.from(deduped.values()).sort((left, right) => left.localeCompare(right));
};

const extractValuesFromDocument = (document) => {
  if (Array.isArray(document?.values)) {
    return document.values;
  }

  if (typeof document?.label === "string") {
    return [document.label];
  }

  return [];
};

const groupDocuments = (documents) => {
  const grouped = new Map();

  documents.forEach((document) => {
    const type = normalizeType(document?.type);
    if (!VALID_TYPES.includes(type)) return;

    const current = grouped.get(type) || {
      _id: document._id,
      type,
      values: [],
      isActive: document?.isActive !== false,
      createdAt: document?.createdAt,
      updatedAt: document?.updatedAt,
    };

    current.values = normalizeValues([...current.values, ...extractValuesFromDocument(document)]);
    current.isActive = current.isActive || document?.isActive !== false;

    if (!current.createdAt || (document?.createdAt && new Date(document.createdAt) < new Date(current.createdAt))) {
      current.createdAt = document.createdAt;
    }

    if (!current.updatedAt || (document?.updatedAt && new Date(document.updatedAt) > new Date(current.updatedAt))) {
      current.updatedAt = document.updatedAt;
    }

    grouped.set(type, current);
  });

  return Array.from(grouped.values()).sort((left, right) => left.type.localeCompare(right.type));
};

const toFlatLookupOptions = (groupedOptions) =>
  groupedOptions.flatMap((option) =>
    option.values.map((label, index) => ({
      _id: `${option._id}-${index}`,
      type: option.type,
      label,
      isActive: option.isActive,
    }))
  );

const consolidateTypeDocuments = async (type, payload, preferredId = null) => {
  const existingDocuments = await InvestigationOption.find({ type }).sort({ createdAt: 1, _id: 1 }).lean();

  const values = normalizeValues(payload.values);
  if (values.length === 0) {
    throw new Error("At least one value is required");
  }

  const preferredIdString = preferredId ? String(preferredId) : null;
  const preferredDocument = preferredIdString
    ? existingDocuments.find((document) => String(document._id) === preferredIdString)
    : null;
  const primaryDocument = preferredDocument || existingDocuments[0] || null;

  let savedDocument;

  if (primaryDocument) {
    savedDocument = await InvestigationOption.findByIdAndUpdate(
      primaryDocument._id,
      {
        type,
        values,
        isActive: typeof payload.isActive === "boolean" ? payload.isActive : primaryDocument.isActive !== false,
      },
      { new: true, runValidators: true }
    );
  } else {
    savedDocument = await InvestigationOption.create({
      type,
      values,
      isActive: typeof payload.isActive === "boolean" ? payload.isActive : true,
    });
  }

  await InvestigationOption.deleteMany({
    type,
    _id: { $ne: savedDocument._id },
  });

  return savedDocument;
};

export const getInvestigationOptions = async (req, res) => {
  try {
    const { type } = req.query;
    const normalizedType = normalizeType(type);

    if (type) {
      if (!VALID_TYPES.includes(normalizedType)) {
        return res.status(400).json({ message: "Invalid type. Use condition or behaviour." });
      }
    }

    const documents = await InvestigationOption.find(
      normalizedType ? { type: normalizedType, isActive: true } : {}
    )
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    const groupedOptions = groupDocuments(documents);

    if (normalizedType) {
      return res.status(200).json({
        data: toFlatLookupOptions(groupedOptions.filter((option) => option.isActive !== false)),
      });
    }

    return res.status(200).json({ data: groupedOptions });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const createInvestigationOption = async (req, res) => {
  try {
    const { type, label, values, isActive } = req.body;

    const normalizedType = normalizeType(type);
    const normalizedValues = normalizeValues(Array.isArray(values) ? values : [label]);

    if (!VALID_TYPES.includes(normalizedType)) {
      return res.status(400).json({ message: "Type is required and must be condition or behaviour" });
    }

    if (normalizedValues.length === 0) {
      return res.status(400).json({ message: "At least one value is required" });
    }

    const option = await consolidateTypeDocuments(normalizedType, {
      values: normalizedValues,
      isActive,
    });

    return res.status(201).json({ message: "Option saved successfully", data: option });
  } catch (error) {
    if (error?.message === "At least one value is required") {
      return res.status(400).json({ message: error.message });
    }
    console.log(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateInvestigationOption = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, label, values, isActive } = req.body;

    const existingOption = await InvestigationOption.findById(id).lean();
    if (!existingOption) {
      return res.status(404).json({ message: "Option not found" });
    }

    const nextType = type ? normalizeType(type) : normalizeType(existingOption.type);
    const fallbackValues = extractValuesFromDocument(existingOption);
    const nextValues = normalizeValues(Array.isArray(values) ? values : label ? [label] : fallbackValues);

    if (!VALID_TYPES.includes(nextType)) {
      return res.status(400).json({ message: "Type must be condition or behaviour" });
    }

    if (nextValues.length === 0) {
      return res.status(400).json({ message: "At least one value is required" });
    }

    const updated = await consolidateTypeDocuments(
      nextType,
      {
        values: nextValues,
        isActive: typeof isActive === "boolean" ? isActive : existingOption.isActive !== false,
      },
      id
    );

    if (nextType !== existingOption.type) {
      await InvestigationOption.deleteOne({ _id: id, type: existingOption.type });
    }

    return res.status(200).json({ message: "Option updated successfully", data: updated });
  } catch (error) {
    if (error?.message === "At least one value is required") {
      return res.status(400).json({ message: error.message });
    }
    console.log(error);
    return res.status(500).json({ message: "Internal Server Error" });
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
