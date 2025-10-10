const API_BASE_URL = 'http://localhost:8000/api';

// Generic API call function
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

// Patient API
export const patientApi = {
  create: (patientData: any) => apiCall('/patients/', {
    method: 'POST',
    body: JSON.stringify(patientData),
  }),
  
  getAll: () => apiCall('/patients/'),
  
  getById: (patientId: number) => apiCall(`/patients/${patientId}`),
  
  update: (patientId: number, patientData: any) => apiCall(`/patients/${patientId}`, {
    method: 'PUT',
    body: JSON.stringify(patientData),
  }),
  
  delete: (patientId: number) => apiCall(`/patients/${patientId}`, {
    method: 'DELETE',
  }),
};

// Analysis API
export const analysisApi = {
  analyze: async (patientId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/analyze/${patientId}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.statusText}`);
    }

    return response.json();
  },
};

// AI Explanation API
export const aiApi = {
  explain: (explanationData: any) => apiCall('/explain', {
    method: 'POST',
    body: JSON.stringify(explanationData),
  }),
};

// Report API
// Report API with better error handling
export const reportApi = {
  create: async (reportData: any) => {
    try {
      const response = await apiCall('/reports/', {
        method: 'POST',
        body: JSON.stringify(reportData),
      });
      return response;
    } catch (error) {
      console.error('Failed to create report:', error);
      throw error;
    }
  },
  
  download: async (reportId: number) => {
    try {
      // Create a hidden anchor element to trigger download
      const link = document.createElement('a');
      link.href = `${API_BASE_URL}/reports/${reportId}`;
      link.target = '_blank';
      link.download = `pathology_report_${reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    } catch (error) {
      console.error('Failed to download report:', error);
      throw error;
    }
  },
  
  getPatientReports: (patientId: number) => apiCall(`/patients/${patientId}/reports`),
};

// Health check
export const healthCheck = () => apiCall('/health');