import IncidentModel from "./incident.model.js";

const incidentController = async (req, res) => {
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
      actions
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
      createdBy: req.user.id
    });

    res
      .status(201)
      .json({ message: "Incident Created Successfully", data: Incident });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getAllIncidents = async (req, res) => {
  try {
    const incidents = await IncidentModel.find()
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });
    res.status(200).json({ data: incidents });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const getIncidentById = async (req, res) => {
  try {
    const incident = await IncidentModel.findById(req.params.id)
      .populate("createdBy", "name email");

    if (!incident) {
      return res.status(404).json({ message: "Incident not found" });
    }
    res.status(200).json({ data: incident });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteIncident = async (req, res) => {
  try {
    const incident = await IncidentModel.findByIdAndDelete(req.params.id);
    if (!incident) {
      return res.status(404).json({ message: "Incident not found" });
    }
    res.status(200).json({ message: "Incident deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteMultipleIncidents = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "Invalid IDs provided" });
    }
    await IncidentModel.deleteMany({ _id: { $in: ids } });
    res.status(200).json({ message: "Incidents deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  incidentController,
  getAllIncidents,
  getIncidentById,
  deleteIncident,
  deleteMultipleIncidents
};
