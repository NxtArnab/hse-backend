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
      witness_name,
      witness_statement,
      witness_Date_received,
      witness_attachment,
      action_type,
      action_description,
      action_attachment,
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
      witness_name,
      witness_statement,
      witness_Date_received,
      witness_attachment,
      action_type,
      action_description,
      action_attachment,
    });

    res
      .status(201)
      .json({ message: "Incident Created Successfully", data: Incident });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export default incidentController;
