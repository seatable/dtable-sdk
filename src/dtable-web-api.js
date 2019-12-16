import axios from 'axios';

class DTableWebAPI {
  
  constructor(config) {
    this.config = config;
    this.req = axios.create();
  }

  getDTableAccessToken() {
    const { server, APIToken } = this.config;
    const url = server + '/api/v2.1/dtable/app-access-token/';
    const headers = { 'Authorization': 'Token ' + APIToken };
    return this.req.get(url, { headers:  headers });
  }

  getFileUploadLink() {
    const { server, APIToken, workspaceID, dtableName } = this.config;
    const url = server + '/api/v2.1/dtable/app-upload-link/';
    const headers = { 'Authorization': 'Token ' + APIToken };
    const params = { workspace_id: workspaceID, name: dtableName };
    return this.req.get(url, { headers: headers, params: params });
  }

}

export default DTableWebAPI;