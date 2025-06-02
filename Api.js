const axios = require("axios");

const Api = async (url, method, body = {}, isFormData = false, retries = 3) => {
  const { CancelToken } = axios;
  const source = CancelToken.source();
  var apiTimeout = setTimeout(() => {
    source.cancel("Request Timed out");
  }, 60000); // Increased timeout to 60 seconds

  let headers;
  if (isFormData) {
    headers = {
      "Content-Type": "multipart/form-data",
    };
  } else {
    headers = {
      "Content-Type": "application/json",
    };
  }

  const structure = {
    url,
    method,
    headers,
    cancelToken: source.token,
  };

  if (method === "GET") {
    structure.params = body;
  } else {
    structure.data = body;
  }

  while (retries) {
    try {
      const resp = await axios(structure);
      clearTimeout(apiTimeout); // Clear timeout on success
      if (resp?.data?.code === 200) {
        return {
          message: resp?.data?.message,
          data: resp?.data?.data,
          success: true,
        };
      } else {
        return resp.data;
      }
    } catch (error) {
      clearTimeout(apiTimeout); // Clear timeout on error
      retries--;
      if (retries === 0) {
        return error?.response?.data
          ? error.response.data
          : {
              message: error?.message ? error.message : "Something went wrong!",
              data: null,
              success: false,
            };
      }
    }
  }
};

module.exports = Api;
