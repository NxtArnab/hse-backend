import IncidentModel from "./incident.model.js";

export const createIncident = async (req, res) => {
  try {
    const {
      incident_title,
      incident_eventTime,
      incident_recordable,
      incident_description,
      incident_eventDate,
      incident_timeUnknown,
      incident_isPrivate,
      incident_attachment,
      investigation_contributing_behaviour,
      investigation_contributing_condition,
      recordTypeForms,
      observation_description,
      observation_status,
      observation_observedBy,
      observation_files,
      witnesses,
      actions,
    } = req.body;

    const Incident = await IncidentModel.create({
      incident_title,
      incident_eventTime,
      incident_recordable,
      incident_description,
      incident_eventDate,
      incident_timeUnknown,
      incident_isPrivate,
      incident_attachment,
      investigation_contributing_behaviour,
      investigation_contributing_condition,
      recordTypeForms,
      observation_description,
      observation_status,
      observation_observedBy,
      observation_files,
      witnesses,
      actions,
      createdBy: req.user.id,
    });

    res
      .status(201)
      .json({ message: "Incident Created Successfully", data: Incident });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getIncidents = async (req, res) => {
  try {
    const incidents = await IncidentModel.find()
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });
    res.status(200).json({ data: incidents });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getIncidentById = async (req, res) => {
  try {
    const { id } = req.params;
    const incident = await IncidentModel.findById(id).populate("createdBy", "name email");
    if (!incident) {
      return res.status(404).json({ message: "Incident Not Found" });
    }
    res.status(200).json({ data: incident });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      incident_title,
      incident_eventTime,
      incident_recordable,
      incident_description,
      incident_eventDate,
      incident_timeUnknown,
      incident_isPrivate,
      incident_attachment,
      investigation_contributing_behaviour,
      investigation_contributing_condition,
      recordTypeForms,
      observation_description,
      observation_status,
      observation_observedBy,
      observation_files,
      witnesses,
      actions,
    } = req.body;

    const updatedIncident = await IncidentModel.findByIdAndUpdate(
      id,
      {
        incident_title,
        incident_eventTime,
        incident_recordable,
        incident_description,
        incident_eventDate,
        incident_timeUnknown,
        incident_isPrivate,
        incident_attachment,
        investigation_contributing_behaviour,
        investigation_contributing_condition,
        recordTypeForms,
        observation_description,
        observation_status,
        observation_observedBy,
        observation_files,
        witnesses,
        actions,
      },
      { new: true },
    );

    if (!updatedIncident) {
      return res.status(404).json({ message: "Incident Not Found" });
    }

    res.status(200).json({ message: "Incident Updated Successfully", data: updatedIncident });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteIncident = async (req, res) => {
  try {
    const { id } = req.params;
    await IncidentModel.findByIdAndDelete(id);
    res.status(200).json({ message: "Incident Deleted Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const bulkDeleteIncidents = async (req, res) => {
  try {
    const { ids } = req.body;
    await IncidentModel.deleteMany({ _id: { $in: ids } });
    res.status(200).json({ message: "Incidents Deleted Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
