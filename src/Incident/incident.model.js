// Note : Distribution and Location are pending to be added....

import mongoose from "mongoose";

const incidentSchema = new mongoose.Schema({
     incident_title:{
        type:String,
        required:false
    },
    incident_eventTime:{
        hour:{
            type:Number,
            min:1,
            max:12,
            required:false
        },
        minute:{
            type:Number,
            min:0,
            max:59,
            required:false
        },
        period:{
            type:String,
            enum:["AM","PM"],
            required:false
        }
    },
    incident_recordable:{
        type:Boolean,
        default:false
    },
    incident_description:{
        type:String,
        required:true
    },
    incident_eventDate:{
        type:Date,
        required:true
    },
    incident_timeUnknown:{
        type:Boolean,
        default:false
    },
    incident_isPrivate:{
        type:Boolean,
        default:false
    },
    incident_attachment:{
        originalName:{
            type:String,
            required:false
        },
        storedName:{
            type:String,
            required:false
        },
        fileUrl:{
            type:String,
            required:false
        },
        mimeType:{
            type:String,
            required:false
        },
        fileSize:{
            type:Number,
            required:false
        },
        extension:{
            type:String,
            required:false
        }
    },
     investigation_contributing_behaviour:{
        type : String,
        enum:["Equipment","Environment"],
        required : false
    },
    investigation_contributing_condition : {
        type : String,
        enum:["Physical","Psychological"],
        required : false
    },
    recordTypeForms: [
      {
        template: {
        type: String,
        required: true
        },
        formData: {
        type: mongoose.Schema.Types.Mixed,
        required: true
        }
     }
    ],
    observation_description : {
        type : String,
        required : true
    },
    observation_status : {
        type : String,
        enum:["Verified","Not Effective","Needs Follow-Up"]
    },
    observation_observedBy:{
        type : String,
        enum : ["Supervisor","Safety Officer"],
        required : true
    },
    observation_files:{
        originalName:{
            type:String,
            required:false
        },
        storedName:{
            type:String,
            required:false
        },
        fileUrl:{
            type:String,
            required:false
        },
        mimeType:{
            type:String,
            required:false
        },
        fileSize:{
            type:Number,
            required:false
        },
        extension:{
            type:String,
            required:false
        }
    },
    witness_name:{
        type : String,
        required : true
    },
    witness_statement:{
        type : String,
        required : true
    },
    witness_Date_received : {
        type : Date,
        required : true
    },
    witness_attachment : {
       originalName:{
            type:String,
            required:false
        },
        storedName:{
            type:String,
            required:false
        },
        fileUrl:{
            type:String,
            required:false
        },
        mimeType:{
            type:String,
            required:false
        },
        fileSize:{
            type:Number,
            required:false
        },
        extension:{
            type:String,
            required:false
        }
    },
    action_type:{
        type : String,
        enum:["Corrective","Preventive"], 
        required : true
    },
    action_description:{
        type : String,
        required : true
    },
    action_attachment:{
        originalName:{
            type:String,
            required:false
        },
        storedName:{
            type:String,
            required:false
        },
        fileUrl:{
            type:String,
            required:false
        },
        mimeType:{
            type:String,
            required:false
        },
        fileSize:{
            type:Number,
            required:false
        },
        extension:{
            type:String,
            required:false
        }
    }
},{timestamps:true});

const IncidentModel = mongoose.model("Incident",incidentSchema);

export default IncidentModel;