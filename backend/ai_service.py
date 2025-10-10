import os
import json
from groq import Groq
from schemas import AIExplanationRequest, AIExplanationResponse
from typing import Dict, Any, List

class AIService:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY", "your-groq-api-key"))
    
    def generate_explanation(self, request: AIExplanationRequest) -> AIExplanationResponse:
        """
        Generate AI-powered explanation using REAL ML data
        """
        try:
            prompt = self._build_real_data_prompt(request)
            
            response = self.client.chat.completions.create(
                model="llama3-8b-8192",
                messages=[
                    {
                        "role": "system",
                        "content": """You are a medical AI assistant specializing in pathology. 
                        Provide clear, professional explanations based on ACTUAL ML analysis results.
                        Focus on clinical relevance and actionable insights from real data."""
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=1024
            )
            
            explanation_text = response.choices[0].message.content
            return self._parse_real_explanation(explanation_text, request)
            
        except Exception as e:
            # Fallback using REAL data, not hardcoded
            return self._generate_real_fallback_explanation(request)
    
    def _build_real_data_prompt(self, request: AIExplanationRequest) -> str:
        """Build prompt using REAL ML analysis data"""
        patient_info = request.patient_info
        analysis_data = request.analysis_data
        
        # Extract REAL metrics
        metrics = analysis_data.get('metrics', {})
        raw_predictions = analysis_data.get('raw_predictions', {})
        regions = analysis_data.get('regions', [])
        
        prompt = f"""
        REAL PATHOLOGY ANALYSIS RESULTS - BASED ON ACTUAL ML PREDICTIONS:

        PATIENT INFORMATION:
        - Name: {patient_info.get('name', 'Not provided')}
        - Age: {patient_info.get('age', 'N/A')}
        - Gender: {patient_info.get('gender', 'N/A')}
        - Medical History: {patient_info.get('medical_history', 'Not provided')}

        ACTUAL ML ANALYSIS RESULTS:
        - Overall Lesion Probability: {analysis_data.get('lesion_probability', 'N/A')}%
        - Overall Confidence: {analysis_data.get('overall_confidence', 'N/A')}%
        - Confidence Level: {analysis_data.get('confidence_level', 'N/A')}

        REAL PREDICTION METRICS:
        - Total Tiles Analyzed: {metrics.get('total_tiles_analyzed', 0)}
        - Tumor-Positive Tiles: {metrics.get('tumor_tiles_detected', 0)}
        - Average Tumor Confidence: {metrics.get('average_tumor_confidence', 0)}%
        - Tumor Probability Range: {raw_predictions.get('tumor_probabilities', [])}

        HIGH-PROBABILITY REGIONS (from ML):
        {json.dumps(regions, indent=2)}

        ANALYSIS SUMMARY:
        {analysis_data.get('analysis_summary', 'No summary available')}

        SPECIFIC QUESTION: {request.specific_question or 'Please provide a clinical explanation of these REAL ML analysis results.'}

        Based on these ACTUAL ML predictions, please provide:
        1. Clinical interpretation of the lesion probability and confidence levels
        2. Significance of the high-probability regions identified
        3. Clinical recommendations based on the actual findings
        4. Any limitations or considerations for these ML results
        """
        
        return prompt
    
    def _parse_real_explanation(self, explanation_text: str, request: AIExplanationRequest) -> AIExplanationResponse:
        """Parse explanation focusing on real data"""
        # Simple parsing that maintains real data context
        lines = explanation_text.split('\n')
        key_findings = []
        recommendations = []
        explanation = ""
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if any(word in line.lower() for word in ['recommend', 'suggest', 'should', 'consider']):
                recommendations.append(line)
            elif any(word in line.lower() for word in ['finding', 'detected', 'identified', 'shows']):
                key_findings.append(line)
            else:
                explanation += line + " "
        
        # Ensure we have meaningful content based on real data
        if not key_findings:
            analysis_data = request.analysis_data
            key_findings = [
                f"ML analysis shows {analysis_data.get('lesion_probability', 0)}% lesion probability",
                f"Confidence level: {analysis_data.get('confidence_level', 'Unknown')}",
                f"Identified {len(analysis_data.get('regions', []))} high-probability regions"
            ]
        
        if not recommendations:
            confidence = request.analysis_data.get('confidence_level', 'Unknown')
            if confidence == "High":
                recommendations = ["Proceed with clinical correlation", "Standard oncology follow-up recommended"]
            elif confidence == "Moderate":
                recommendations = ["Manual pathology review recommended", "Correlate with clinical presentation"]
            else:
                recommendations = ["Expert pathologist review required", "Consider additional diagnostic tests"]
        
        return AIExplanationResponse(
            explanation=explanation.strip() or explanation_text,
            key_findings=key_findings,
            recommendations=recommendations
        )
    
    def _generate_real_fallback_explanation(self, request: AIExplanationRequest) -> AIExplanationResponse:
        """Fallback explanation using REAL data only"""
        analysis_data = request.analysis_data
        patient_info = request.patient_info
        
        lesion_prob = analysis_data.get('lesion_probability', 0)
        confidence_level = analysis_data.get('confidence_level', 'Unknown')
        regions = analysis_data.get('regions', [])
        metrics = analysis_data.get('metrics', {})
        
        explanation = f"Analysis for {patient_info.get('name', 'the patient')} shows {lesion_prob}% lesion probability with {confidence_level.lower()} confidence. "
        explanation += f"ML model analyzed {metrics.get('total_tiles_analyzed', 0)} tissue regions and identified {len(regions)} high-probability areas."
        
        key_findings = [
            f"Lesion probability: {lesion_prob}%",
            f"Confidence level: {confidence_level}",
            f"High-probability regions: {len(regions)}"
        ]
        
        if confidence_level == "High":
            recommendations = ["Proceed with standard clinical protocols", "Correlate with patient history"]
        elif confidence_level == "Moderate":
            recommendations = ["Manual pathology review recommended", "Consider additional imaging"]
        else:
            recommendations = ["Expert evaluation required", "Additional diagnostic tests may be needed"]
        
        return AIExplanationResponse(
            explanation=explanation,
            key_findings=key_findings,
            recommendations=recommendations
        )