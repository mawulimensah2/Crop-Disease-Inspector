import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Camera,
  Scan,
  Leaf,
  AlertTriangle,
  CheckCircle,
  X,
  Image as ImageIcon,
  ChevronRight,
  Sprout,
  Shield,
  Info,
  History,
  Trash2,
  Loader2,
  Search,
  Droplets,
  Bug,
  ThermometerSun,
  Wind,
  Sun,
} from 'lucide-react';
import { supabase } from './lib/supabase';

/* ─── Types ─── */
interface DiseaseResult {
  id: string;
  crop: string;
  disease: string;
  confidence: number;
  severity: 'Low' | 'Moderate' | 'High' | 'Critical';
  symptoms: string[];
  causes: string[];
  treatment: string[];
  prevention: string[];
  imageUrl: string;
  createdAt: string;
}

interface InspectionRecord {
  id: string;
  crop_name: string;
  disease_name: string;
  confidence: number;
  severity: string;
  image_url: string | null;
  created_at: string;
}

/* ─── Severity helpers ─── */
function severityColor(severity: string) {
  switch (severity) {
    case 'Low':
      return 'bg-emerald-500';
    case 'Moderate':
      return 'bg-amber-500';
    case 'High':
      return 'bg-orange-500';
    case 'Critical':
      return 'bg-red-500';
    default:
      return 'bg-slate-500';
  }
}

function severityTextColor(severity: string) {
  switch (severity) {
    case 'Low':
      return 'text-emerald-600';
    case 'Moderate':
      return 'text-amber-600';
    case 'High':
      return 'text-orange-600';
    case 'Critical':
      return 'text-red-600';
    default:
      return 'text-slate-600';
  }
}

/* ─── Disease knowledge base keyed by class_name from model ─── */
const DISEASE_DB: Record<
  string,
  {
    severity: 'Low' | 'Moderate' | 'High' | 'Critical';
    symptoms: string[];
    causes: string[];
    treatment: string[];
    prevention: string[];
  }
> = {
  'Apple___Apple_scab': {
    severity: 'Moderate',
    symptoms: [
      'Olive-green to black spots on leaves',
      'Corky scabs on fruit surface',
      'Premature leaf drop',
      'Cracked and deformed fruit',
    ],
    causes: [
      'Fungus Venturia inaequalis',
      'Wet spring weather',
      'Temperatures 10-20°C',
      'Overwintering infected leaves',
    ],
    treatment: [
      'Apply fungicides at green tip stage',
      'Rake and remove fallen leaves',
      'Prune for better air circulation',
      'Use sulfur sprays for organic control',
    ],
    prevention: [
      'Plant scab-resistant varieties',
      'Maintain sanitation practices',
      'Apply preventive fungicides',
      'Monitor primary infection periods',
    ],
  },
  'Apple___Black_rot': {
    severity: 'High',
    symptoms: [
      'Purple spots on leaves with defined margins',
      'Frog-eye spots on fruit',
      'Cankers on branches and trunk',
      'Fruit rot with concentric rings',
    ],
    causes: [
      'Fungus Botryosphaeria obtusa',
      'Wounds or stress on trees',
      'Warm humid conditions',
      'Poor orchard sanitation',
    ],
    treatment: [
      'Prune out cankers during dormancy',
      'Apply fungicides during growing season',
      'Remove mummified fruit',
      'Improve tree vigor with proper nutrition',
    ],
    prevention: [
      'Sanitize pruning tools',
      'Remove infected plant debris',
      'Avoid mechanical injuries to trees',
      'Apply protective fungicides',
    ],
  },
  'Apple___Cedar_apple_rust': {
    severity: 'Moderate',
    symptoms: [
      'Yellow-orange spots on leaves',
      'Tiny black dots in center of spots',
      'Cedar galls with orange gelatinous horns',
      'Premature defoliation',
    ],
    causes: [
      'Fungus Gymnosporangium juniperi-virginianae',
      'Alternate host (cedar/juniper) nearby',
      'Cool wet spring weather',
      'Wind-borne spores from galls',
    ],
    treatment: [
      'Apply fungicides at pink bud stage',
      'Remove cedar galls when possible',
      'Rake and destroy fallen leaves',
      'Use resistant apple varieties',
    ],
    prevention: [
      'Plant resistant varieties',
      'Separate apple trees from cedar hosts',
      'Apply preventive sprays before infection',
      'Monitor weather for infection periods',
    ],
  },
  'Apple___healthy': {
    severity: 'Low',
    symptoms: ['No visible disease symptoms', 'Vibrant green foliage', 'Normal fruit development'],
    causes: ['Proper cultural practices', 'Adequate nutrition and water', 'Good air circulation'],
    treatment: ['Continue current maintenance practices', 'Monitor for early signs of disease'],
    prevention: [
      'Maintain regular spray schedule',
      'Proper pruning for air flow',
      'Balanced fertilization',
      'Regular monitoring',
    ],
  },
  'Blueberry___healthy': {
    severity: 'Low',
    symptoms: ['No visible disease symptoms', 'Vibrant green foliage', 'Normal berry development'],
    causes: ['Proper cultural practices', 'Adequate nutrition and water', 'Good air circulation'],
    treatment: ['Continue current maintenance practices', 'Monitor for early signs of disease'],
    prevention: [
      'Maintain proper soil pH (4.5-5.5)',
      'Adequate irrigation',
      'Proper pruning',
      'Regular monitoring',
    ],
  },
  'Cherry_(including_sour)___Powdery_mildew': {
    severity: 'Moderate',
    symptoms: [
      'White powdery coating on leaves',
      'Distorted and curled leaves',
      'Stunted shoot growth',
      'Premature leaf drop',
    ],
    causes: [
      'Fungus Podosphaera clandestina',
      'Warm dry days and cool nights',
      'Dense tree canopy',
      'Poor air circulation',
    ],
    treatment: [
      'Apply sulfur or synthetic fungicides',
      'Prune for better air circulation',
      'Remove severely infected shoots',
      'Improve tree vigor',
    ],
    prevention: [
      'Plant resistant varieties',
      'Proper spacing and pruning',
      'Avoid excessive nitrogen',
      'Monitor for early symptoms',
    ],
  },
  'Cherry_(including_sour)___healthy': {
    severity: 'Low',
    symptoms: ['No visible disease symptoms', 'Vibrant green foliage', 'Normal fruit development'],
    causes: ['Proper cultural practices', 'Adequate nutrition and water'],
    treatment: ['Continue current maintenance practices'],
    prevention: [
      'Maintain regular spray schedule',
      'Proper pruning',
      'Balanced fertilization',
    ],
  },
  'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot': {
    severity: 'High',
    symptoms: [
      'Small tan lesions with brown borders',
      'Lesions rectangular and vein-limited',
      'Grayish center with yellow halos',
      'Severe leaf blighting under pressure',
    ],
    causes: [
      'Fungus Cercospora zeae-maydis',
      'Warm humid conditions (24-30°C)',
      'Extended leaf wetness',
      'Reduced tillage practices',
    ],
    treatment: [
      'Apply foliar fungicides at tasseling',
      'Improve field drainage',
      'Monitor disease progression',
      'Consider early harvest if severe',
    ],
    prevention: [
      'Rotate with non-host crops',
      'Plant resistant hybrids',
      'Manage residue properly',
      'Avoid continuous corn planting',
    ],
  },
  'Corn_(maize)___Common_rust_': {
    severity: 'Moderate',
    symptoms: [
      'Small cinnamon-brown pustules on leaves',
      'Pustules on both leaf surfaces',
      'Yellowing around pustules',
      'Premature senescence in severe cases',
    ],
    causes: [
      'Fungus Puccinia sorghi',
      'Cool moist conditions (15-25°C)',
      'Wind-borne spores from southern regions',
      'Susceptible hybrids',
    ],
    treatment: [
      'Apply foliar fungicides if before tasseling',
      'Monitor rust severity ratings',
      'Ensure adequate fertility',
      'Consider early harvest',
    ],
    prevention: [
      'Plant resistant hybrids',
      'Monitor regional rust movement',
      'Timely planting',
      'Scout fields regularly',
    ],
  },
  'Corn_(maize)___Northern_Leaf_Blight': {
    severity: 'High',
    symptoms: [
      'Long elliptical gray-green lesions',
      'Lesions 2-15 cm long on leaves',
      'Severe leaf blighting and death',
      'Reduced ear size and quality',
    ],
    causes: [
      'Fungus Exserohilum turcicum',
      'Moderate temperatures (18-27°C)',
      'Extended periods of leaf wetness',
      'Reduced tillage practices',
    ],
    treatment: [
      'Apply foliar fungicides at tasseling',
      'Improve field drainage',
      'Remove crop residue after harvest',
      'Monitor disease progression',
    ],
    prevention: [
      'Plant resistant hybrids',
      'Rotate with non-host crops',
      'Manage residue properly',
      'Avoid continuous corn planting',
    ],
  },
  'Corn_(maize)___healthy': {
    severity: 'Low',
    symptoms: ['No visible disease symptoms', 'Vibrant green foliage', 'Normal ear development'],
    causes: ['Proper cultural practices', 'Adequate nutrition and water'],
    treatment: ['Continue current maintenance practices'],
    prevention: [
      'Crop rotation',
      'Balanced fertilization',
      'Proper plant spacing',
    ],
  },
  'Grape___Black_rot': {
    severity: 'High',
    symptoms: [
      'Small brown spots on leaves with black dots',
      'Shrivelled black mummified fruit',
      'Cane lesions with purple borders',
      'Complete fruit loss in severe cases',
    ],
    causes: [
      'Fungus Guignardia bidwellii',
      'Warm humid conditions (20-27°C)',
      'Rain splash spreads spores',
      'Overwintering in mummified berries',
    ],
    treatment: [
      'Apply fungicides at bud break',
      'Remove mummified berries',
      'Prune out infected canes',
      'Improve air circulation in canopy',
    ],
    prevention: [
      'Sanitation - remove infected material',
      'Proper canopy management',
      'Regular fungicide schedule',
      'Monitor weather for infection periods',
    ],
  },
  'Grape___Esca_(Black_Measles)': {
    severity: 'Critical',
    symptoms: [
      'Tiger-striped leaves on red varieties',
      'White varieties show chlorotic stripes',
      'Black measles spots on fruit',
      'Sudden vine collapse',
    ],
    causes: [
      'Complex of fungi (Phaeomoniella, Phaeoacremonium)',
      'Pruning wounds entry point',
      'Chronic vine stress',
      'No known cure once infected',
    ],
    treatment: [
      'No effective treatment available',
      'Remove severely infected vines',
      'Protect pruning wounds immediately',
      'Avoid stress to infected vines',
    ],
    prevention: [
      'Protect all pruning wounds with fungicide',
      'Use clean pruning tools',
      'Avoid unnecessary trunk injuries',
      'Select tolerant rootstocks',
    ],
  },
  'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)': {
    severity: 'Moderate',
    symptoms: [
      'Brown irregular spots on leaves',
      'Spots with dark borders and tan centers',
      'Premature defoliation',
      'Reduced vine vigor',
    ],
    causes: [
      'Fungus Pseudocercospora vitis',
      'Warm humid conditions',
      'Poor air circulation',
      'Overcrowded canopies',
    ],
    treatment: [
      'Apply copper or systemic fungicides',
      'Improve canopy air circulation',
      'Remove severely infected leaves',
      'Adjust irrigation timing',
    ],
    prevention: [
      'Proper trellis and canopy management',
      'Adequate vine spacing',
      'Preventive fungicide applications',
      'Monitor for early symptoms',
    ],
  },
  'Grape___healthy': {
    severity: 'Low',
    symptoms: ['No visible disease symptoms', 'Vibrant green foliage', 'Normal fruit development'],
    causes: ['Proper cultural practices', 'Adequate nutrition and water'],
    treatment: ['Continue current maintenance practices'],
    prevention: [
      'Regular spray schedule',
      'Proper canopy management',
      'Balanced fertilization',
    ],
  },
  'Orange___Haunglongbing_(Citrus_greening)': {
    severity: 'Critical',
    symptoms: [
      'Blotchy mottle on leaves',
      'Lopsided bitter fruit',
      'Twig dieback and tree decline',
      'Yellow shoots on individual branches',
    ],
    causes: [
      'Bacterium Candidatus Liberibacter',
      'Spread by Asian citrus psyllid',
      'No cure available',
      'Infected budwood transmission',
    ],
    treatment: [
      'No cure - remove infected trees',
      'Control psyllid populations',
      'Use certified disease-free nursery stock',
      'Consider tree replacement',
    ],
    prevention: [
      'Use certified clean nursery stock',
      'Aggressive psyllid control',
      'Remove infected trees promptly',
      'Quarantine new plantings',
    ],
  },
  'Peach___Bacterial_spot': {
    severity: 'Critical',
    symptoms: [
      'Dark spots on leaves with yellow halos',
      'Cankers on twigs and fruit',
      'Shot hole appearance on leaves',
      'Fruit cracking and deformation',
    ],
    causes: [
      'Bacterium Xanthomonas campestris pv. pruni',
      'Rain splash and wind spread',
      'Warm wet spring weather',
      'Wounds and natural openings entry',
    ],
    treatment: [
      'Apply copper sprays during dormancy',
      'Continue bactericides during season',
      'Prune during dry weather',
      'Remove severely infected branches',
    ],
    prevention: [
      'Plant resistant varieties',
      'Avoid overhead irrigation',
      'Proper tree spacing',
      'Sanitation pruning',
    ],
  },
  'Peach___healthy': {
    severity: 'Low',
    symptoms: ['No visible disease symptoms', 'Vibrant green foliage', 'Normal fruit development'],
    causes: ['Proper cultural practices', 'Adequate nutrition and water'],
    treatment: ['Continue current maintenance practices'],
    prevention: [
      'Regular spray schedule',
      'Proper pruning',
      'Balanced fertilization',
    ],
  },
  'Pepper,_bell___Bacterial_spot': {
    severity: 'Critical',
    symptoms: [
      'Small water-soaked spots on leaves',
      'Spots turn brown with yellow halos',
      'Defoliation and sunscald on fruit',
      'Fruit spots with raised scabby centers',
    ],
    causes: [
      'Bacterium Xanthomonas campestris pv. vesicatoria',
      'Warm wet conditions (24-30°C)',
      'Splashing rain spreads bacteria',
      'Contaminated seed or transplants',
    ],
    treatment: [
      'Apply copper-based bactericides',
      'Remove severely infected plants',
      'Avoid working in wet fields',
      'Rotate with non-host crops',
    ],
    prevention: [
      'Use certified disease-free seed',
      'Avoid overhead irrigation',
      'Crop rotation 2-3 years',
      'Resistant varieties where available',
    ],
  },
  'Pepper,_bell___healthy': {
    severity: 'Low',
    symptoms: ['No visible disease symptoms', 'Vibrant green foliage', 'Normal fruit development'],
    causes: ['Proper cultural practices', 'Adequate nutrition and water'],
    treatment: ['Continue current maintenance practices'],
    prevention: [
      'Crop rotation',
      'Proper spacing',
      'Balanced fertilization',
    ],
  },
  'Potato___Early_blight': {
    severity: 'Moderate',
    symptoms: [
      'Dark brown to black spots on lower leaves',
      'Concentric rings in spots resembling target boards',
      'Yellowing of leaf tissue around spots',
      'Stem lesions near soil line',
    ],
    causes: [
      'Fungus Alternaria solani',
      'Warm humid conditions (24-29°C)',
      'Overhead irrigation',
      'Poor air circulation',
    ],
    treatment: [
      'Remove and destroy infected plant debris',
      'Apply copper-based fungicides',
      'Use resistant varieties for future planting',
      'Maintain proper plant spacing',
    ],
    prevention: [
      'Rotate crops every 3-4 years',
      'Mulch to prevent soil splash',
      'Water at base of plants',
      'Ensure good drainage',
    ],
  },
  'Potato___Late_blight': {
    severity: 'Critical',
    symptoms: [
      'Water-soaked dark lesions on leaves',
      'White fungal growth on leaf undersides',
      'Brown rotting of tubers',
      'Rapid wilting and plant collapse',
    ],
    causes: [
      'Oomycete Phytophthora infestans',
      'Cool wet conditions (10-24°C)',
      'High relative humidity (>90%)',
      'Infected seed tubers',
    ],
    treatment: [
      'Apply systemic fungicides immediately',
      'Destroy all infected plant material',
      'Harvest tubers early if possible',
      'Cure tubers before storage',
    ],
    prevention: [
      'Use certified disease-free seed',
      'Plant resistant varieties',
      'Monitor weather conditions',
      'Apply preventive fungicides',
    ],
  },
  'Potato___healthy': {
    severity: 'Low',
    symptoms: ['No visible disease symptoms', 'Vibrant green foliage', 'Normal tuber development'],
    causes: ['Proper cultural practices', 'Adequate nutrition and water'],
    treatment: ['Continue current maintenance practices'],
    prevention: [
      'Use certified seed potatoes',
      'Crop rotation',
      'Hilling for tuber protection',
    ],
  },
  'Raspberry___healthy': {
    severity: 'Low',
    symptoms: ['No visible disease symptoms', 'Vibrant green foliage', 'Normal berry development'],
    causes: ['Proper cultural practices', 'Adequate nutrition and water'],
    treatment: ['Continue current maintenance practices'],
    prevention: [
      'Proper pruning',
      'Adequate spacing',
      'Balanced fertilization',
    ],
  },
  'Soybean___healthy': {
    severity: 'Low',
    symptoms: ['No visible disease symptoms', 'Vibrant green foliage', 'Normal pod development'],
    causes: ['Proper cultural practices', 'Adequate nutrition and water'],
    treatment: ['Continue current maintenance practices'],
    prevention: [
      'Crop rotation',
      'SCN management',
      'Proper drainage',
    ],
  },
  'Squash___Powdery_mildew': {
    severity: 'Moderate',
    symptoms: [
      'White powdery patches on leaves',
      'Leaves curl and turn brown',
      'Stunted plant growth',
      'Reduced fruit quality',
    ],
    causes: [
      'Fungi Podosphaera xanthii or Erysiphe cichoracearum',
      'Warm dry days with high humidity nights',
      'Dense plantings',
      'Poor air circulation',
    ],
    treatment: [
      'Apply sulfur or potassium bicarbonate',
      'Remove severely infected leaves',
      'Improve air circulation',
      'Water at base of plants',
    ],
    prevention: [
      'Plant resistant varieties',
      'Adequate plant spacing',
      'Avoid overhead watering',
      'Monitor for early symptoms',
    ],
  },
  'Strawberry___Leaf_scorch': {
    severity: 'Moderate',
    symptoms: [
      'Purple to brown spots on leaves',
      'Spots with dark borders',
      'Leaf tips and margins scorched',
      'Reduced runner production',
    ],
    causes: [
      'Fungus Diplocarpon earlianum',
      'Warm wet conditions',
      'Overhead irrigation',
      'Overcrowded plantings',
    ],
    treatment: [
      'Apply fungicides at first sign',
      'Remove infected leaves',
      'Improve air circulation',
      'Avoid wetting foliage',
    ],
    prevention: [
      'Use certified disease-free plants',
      'Proper plant spacing',
      'Mulch to prevent soil splash',
      'Rotate with non-host crops',
    ],
  },
  'Strawberry___healthy': {
    severity: 'Low',
    symptoms: ['No visible disease symptoms', 'Vibrant green foliage', 'Normal fruit development'],
    causes: ['Proper cultural practices', 'Adequate nutrition and water'],
    treatment: ['Continue current maintenance practices'],
    prevention: [
      'Proper spacing',
      'Adequate irrigation',
      'Balanced fertilization',
    ],
  },
  'Tomato___Bacterial_spot': {
    severity: 'Critical',
    symptoms: [
      'Small water-soaked spots on leaves',
      'Spots turn brown with yellow halos',
      'Defoliation and fruit spotting',
      'Fruit spots with scabby appearance',
    ],
    causes: [
      'Bacterium Xanthomonas campestris pv. vesicatoria',
      'Warm wet conditions (24-30°C)',
      'Splashing rain spreads bacteria',
      'Contaminated seed or transplants',
    ],
    treatment: [
      'Apply copper-based bactericides',
      'Remove severely infected plants',
      'Avoid working in wet fields',
      'Rotate with non-host crops',
    ],
    prevention: [
      'Use certified disease-free seed',
      'Avoid overhead irrigation',
      'Crop rotation 2-3 years',
      'Resistant varieties where available',
    ],
  },
  'Tomato___Early_blight': {
    severity: 'Moderate',
    symptoms: [
      'Dark brown to black spots on lower leaves',
      'Concentric rings in spots resembling target boards',
      'Yellowing of leaf tissue around spots',
      'Stem lesions near soil line',
    ],
    causes: [
      'Fungus Alternaria solani',
      'Warm humid conditions (24-29°C)',
      'Overhead irrigation',
      'Poor air circulation',
    ],
    treatment: [
      'Remove and destroy infected plant debris',
      'Apply copper-based fungicides',
      'Use resistant varieties for future planting',
      'Maintain proper plant spacing',
    ],
    prevention: [
      'Rotate crops every 3-4 years',
      'Mulch to prevent soil splash',
      'Water at base of plants',
      'Ensure good drainage',
    ],
  },
  'Tomato___Late_blight': {
    severity: 'Critical',
    symptoms: [
      'Water-soaked dark lesions on leaves',
      'White fungal growth on leaf undersides',
      'Brown rotting of fruit',
      'Rapid wilting and plant collapse',
    ],
    causes: [
      'Oomycete Phytophthora infestans',
      'Cool wet conditions (10-24°C)',
      'High relative humidity (>90%)',
      'Infected transplants',
    ],
    treatment: [
      'Apply systemic fungicides immediately',
      'Destroy all infected plant material',
      'Harvest fruit early if possible',
      'Improve air circulation',
    ],
    prevention: [
      'Use certified disease-free transplants',
      'Plant resistant varieties',
      'Monitor weather conditions',
      'Apply preventive fungicides',
    ],
  },
  'Tomato___Leaf_Mold': {
    severity: 'Moderate',
    symptoms: [
      'Yellow spots on upper leaf surface',
      'Olive-green to gray mold on undersides',
      'Leaf curling and browning',
      'Defoliation from bottom up',
    ],
    causes: [
      'Fungus Passalora fulva',
      'High humidity (>85%)',
      'Poor ventilation in greenhouses',
      'Temperatures 20-25°C',
    ],
    treatment: [
      'Improve ventilation and reduce humidity',
      'Apply fungicides to leaf undersides',
      'Remove severely infected leaves',
      'Adjust irrigation practices',
    ],
    prevention: [
      'Use resistant varieties',
      'Ensure good air circulation',
      'Avoid wetting foliage',
      'Proper plant spacing',
    ],
  },
  'Tomato___Septoria_leaf_spot': {
    severity: 'High',
    symptoms: [
      'Small circular spots on lower leaves',
      'Gray centers with dark borders',
      'Tiny black fruiting bodies in centers',
      'Defoliation from ground up',
    ],
    causes: [
      'Fungus Septoria lycopersici',
      'Warm wet conditions (20-25°C)',
      'Splashing rain spreads spores',
      'Overwintering in infected debris',
    ],
    treatment: [
      'Remove lower infected leaves',
      'Apply fungicides preventively',
      'Mulch to prevent soil splash',
      'Improve air circulation',
    ],
    prevention: [
      'Crop rotation 3+ years',
      'Remove infected plant debris',
      'Avoid overhead irrigation',
      'Use resistant varieties',
    ],
  },
  'Tomato___Spider_mites Two-spotted_spider_mite': {
    severity: 'High',
    symptoms: [
      'Tiny yellow stippling on leaves',
      'Fine webbing on undersides',
      'Bronzed or scorched appearance',
      'Premature leaf drop',
    ],
    causes: [
      'Mite Tetranychus urticae',
      'Hot dry conditions',
      'Drought stress on plants',
      'Overuse of broad-spectrum insecticides',
    ],
    treatment: [
      'Apply miticides or insecticidal soap',
      'Increase humidity with overhead watering',
      'Remove heavily infested leaves',
      'Release predatory mites',
    ],
    prevention: [
      'Monitor regularly with hand lens',
      'Maintain plant vigor with water',
      'Avoid excessive nitrogen',
      'Use resistant varieties',
    ],
  },
  'Tomato___Target_Spot': {
    severity: 'High',
    symptoms: [
      'Brown spots with concentric rings',
      'Yellow halos around spots',
      'Spots on leaves, stems, and fruit',
      'Fruit lesions with sunken centers',
    ],
    causes: [
      'Fungus Corynespora cassiicola',
      'Warm humid conditions (24-30°C)',
      'Extended leaf wetness',
      'Poor air circulation',
    ],
    treatment: [
      'Apply fungicides at first sign',
      'Remove infected plant parts',
      'Improve air circulation',
      'Avoid overhead irrigation',
    ],
    prevention: [
      'Crop rotation',
      'Proper plant spacing',
      'Mulch to prevent soil splash',
      'Monitor for early symptoms',
    ],
  },
  'Tomato___Tomato_Yellow_Leaf_Curl_Virus': {
    severity: 'Critical',
    symptoms: [
      'Upward curling of leaves',
      'Yellowing of leaf margins',
      'Stunted plant growth',
      'Reduced fruit production',
    ],
    causes: [
      'Tomato yellow leaf curl virus (TYLCV)',
      'Transmitted by whiteflies',
      'Warm temperatures favor whiteflies',
      'Infected transplants',
    ],
    treatment: [
      'No cure for infected plants',
      'Remove and destroy infected plants',
      'Control whitefly populations',
      'Use reflective mulches',
    ],
    prevention: [
      'Use resistant varieties (TYLCV-resistant)',
      'Control whiteflies with insecticides',
      'Use virus-free transplants',
      'Install insect netting',
    ],
  },
  'Tomato___Tomato_mosaic_virus': {
    severity: 'Critical',
    symptoms: [
      'Mottled light and dark green leaves',
      'Distorted and fern-like foliage',
      'Stunted growth',
      'Internal fruit browning',
    ],
    causes: [
      'Tobacco mosaic virus (TMV)',
      'Mechanical transmission via hands/tools',
      'Infected seed or transplants',
      'Contaminated soil',
    ],
    treatment: [
      'No cure - remove infected plants',
      'Wash hands and sanitize tools',
      'Avoid smoking near plants',
      'Remove weeds that host virus',
    ],
    prevention: [
      'Use resistant varieties (TMV-resistant)',
      'Sanitize tools and hands',
      'Use certified disease-free seed',
      'Rotate crops',
    ],
  },
  'Tomato___healthy': {
    severity: 'Low',
    symptoms: ['No visible disease symptoms', 'Vibrant green foliage', 'Normal fruit development'],
    causes: ['Proper cultural practices', 'Adequate nutrition and water'],
    treatment: ['Continue current maintenance practices'],
    prevention: [
      'Crop rotation',
      'Proper spacing',
      'Balanced fertilization',
      'Regular monitoring',
    ],
  },
};

/* ─── Components ─── */

function ConfidenceRing({ confidence }: { confidence: number }) {
  const radius = 48;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (confidence / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
        <circle
          stroke="#e2e8f0"
          strokeWidth={stroke}
          fill="transparent"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={confidence >= 80 ? '#10b981' : confidence >= 50 ? '#f59e0b' : '#ef4444'}
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          strokeLinecap="round"
          fill="transparent"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold text-slate-800">{confidence}%</span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Confidence</span>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-emerald-600 text-white shadow-md'
          : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function DetailCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-emerald-50 rounded-lg">
          <Icon size={18} className="text-emerald-600" />
        </div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ─── Main App ─── */
export default function App() {
  const [activeTab, setActiveTab] = useState<'inspect' | 'history'>('inspect');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DiseaseResult | null>(null);
  const [history, setHistory] = useState<InspectionRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setHistory(data);
    }
    setHistoryLoading(false);
  }, []);

  const handleTabChange = (tab: 'inspect' | 'history') => {
    setActiveTab(tab);
    if (tab === 'history') {
      fetchHistory();
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
      setResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const analyzeImage = async () => {
    if (!previewImage) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/predict-disease`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ image: previewImage }),
        }
      );

      if (!response.ok) {
        throw new Error(`Analysis failed (${response.status})`);
      }

      const prediction = await response.json();
      if (prediction.error) {
        throw new Error(prediction.error);
      }

      const dbEntry = DISEASE_DB[prediction.class_name];
      const diseaseResult: DiseaseResult = {
        id: crypto.randomUUID(),
        crop: prediction.crop,
        disease: prediction.disease,
        confidence: prediction.confidence,
        severity: prediction.severity,
        symptoms: dbEntry?.symptoms || ['No detailed symptom data available'],
        causes: dbEntry?.causes || ['No detailed cause data available'],
        treatment: dbEntry?.treatment || ['Consult a local agronomist for treatment advice'],
        prevention: dbEntry?.prevention || ['Practice good crop management'],
        imageUrl: previewImage,
        createdAt: new Date().toISOString(),
      };

      await supabase.from('inspections').insert({
        crop_name: diseaseResult.crop,
        disease_name: diseaseResult.disease,
        confidence: diseaseResult.confidence,
        severity: diseaseResult.severity,
        image_url: diseaseResult.imageUrl,
      });

      setResult(diseaseResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearInspection = () => {
    setPreviewImage(null);
    setResult(null);
    setError(null);
  };

  const deleteHistoryItem = async (id: string) => {
    await supabase.from('inspections').delete().eq('id', id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const filteredHistory = history.filter(
    (h) =>
      h.crop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.disease_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 rounded-xl shadow-sm">
              <Sprout size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">Crop Disease Inspector</h1>
              <p className="text-xs text-slate-500">AI-powered plant health diagnosis</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <TabButton
              active={activeTab === 'inspect'}
              onClick={() => handleTabChange('inspect')}
              icon={Scan}
              label="Inspect"
            />
            <TabButton
              active={activeTab === 'history'}
              onClick={() => handleTabChange('history')}
              icon={History}
              label="History"
            />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'inspect' ? (
          <div className="space-y-6">
            {/* Upload Section */}
            {!result && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Inspect Your Crop</h2>
                  <p className="text-slate-500">Upload a photo of the affected plant for AI analysis</p>
                </div>

                {/* Upload Area */}
                {!previewImage ? (
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`max-w-lg mx-auto border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all duration-200 ${
                      dragActive
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-white rounded-full shadow-sm">
                        <Upload size={32} className="text-emerald-600" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-700">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-slate-400 mt-1">PNG, JPG, JPEG up to 10MB</p>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-3 py-1 bg-white rounded-full text-xs text-slate-500 border border-slate-200 flex items-center gap-1">
                          <Camera size={12} /> Take Photo
                        </span>
                        <span className="px-3 py-1 bg-white rounded-full text-xs text-slate-500 border border-slate-200 flex items-center gap-1">
                          <ImageIcon size={12} /> Gallery
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-lg mx-auto">
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                      <img
                        src={previewImage}
                        alt="Uploaded crop"
                        className="w-full h-72 object-cover"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          clearInspection();
                        }}
                        className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <button
                      onClick={analyzeImage}
                      disabled={isAnalyzing}
                      className="w-full mt-4 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Scan size={18} />
                          Analyze Image
                        </>
                      )}
                    </button>
                  </div>
                )}

                {error && (
                  <div className="max-w-lg mx-auto mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
                    <AlertTriangle size={16} />
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Analysis Result */}
            {isAnalyzing && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
                <div className="relative inline-flex items-center justify-center mb-6">
                  <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-30" />
                  <div className="relative p-5 bg-emerald-50 rounded-full">
                    <Scan size={40} className="text-emerald-600 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Analyzing Image...</h3>
                <p className="text-slate-500">Our AI is examining the plant for signs of disease</p>
                <div className="max-w-xs mx-auto mt-6 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full animate-[loading_2s_ease-in-out_infinite]"
                    style={{ width: '60%' }}
                  />
                </div>
              </div>
            )}

            {result && !isAnalyzing && (
              <div className="space-y-6">
                {/* Result Header */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    <div className="sm:w-72 shrink-0">
                      <img
                        src={result.imageUrl}
                        alt="Analyzed crop"
                        className="w-full h-48 sm:h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-slate-500">{result.crop}</span>
                            <ChevronRight size={14} className="text-slate-400" />
                            <span className="text-sm font-medium text-slate-700">{result.disease}</span>
                          </div>
                          <h2 className="text-2xl font-bold text-slate-900">{result.disease}</h2>
                        </div>
                        <ConfidenceRing confidence={result.confidence} />
                      </div>

                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-sm text-slate-600">Severity:</span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white ${severityColor(result.severity)}`}
                        >
                          {result.severity === 'Critical' && <AlertTriangle size={14} />}
                          {result.severity}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <CheckCircle size={14} className="text-emerald-500" />
                        Analysis completed on {new Date(result.createdAt).toLocaleDateString()} at{' '}
                        {new Date(result.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DetailCard title="Symptoms" icon={Search}>
                    <ul className="space-y-2">
                      {result.symptoms.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="mt-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </DetailCard>

                  <DetailCard title="Causes" icon={Info}>
                    <ul className="space-y-2">
                      {result.causes.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="mt-1.5 w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </DetailCard>

                  <DetailCard title="Treatment" icon={Droplets}>
                    <ul className="space-y-2">
                      {result.treatment.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="mt-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </DetailCard>

                  <DetailCard title="Prevention" icon={Shield}>
                    <ul className="space-y-2">
                      {result.prevention.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="mt-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </DetailCard>
                </div>

                {/* Environmental Factors */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <ThermometerSun size={20} className="text-orange-500" />
                    Environmental Risk Factors
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { icon: Droplets, label: 'Humidity', value: 'High', color: 'text-blue-600', bg: 'bg-blue-50' },
                      { icon: ThermometerSun, label: 'Temperature', value: '24-29°C', color: 'text-orange-600', bg: 'bg-orange-50' },
                      { icon: Wind, label: 'Air Flow', value: 'Low', color: 'text-slate-600', bg: 'bg-slate-50' },
                      { icon: Sun, label: 'Sunlight', value: 'Moderate', color: 'text-amber-600', bg: 'bg-amber-50' },
                    ].map((factor) => (
                      <div key={factor.label} className={`${factor.bg} rounded-xl p-4 text-center`}>
                        <factor.icon size={24} className={`${factor.color} mx-auto mb-2`} />
                        <p className="text-xs text-slate-500">{factor.label}</p>
                        <p className={`text-sm font-semibold ${factor.color}`}>{factor.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={clearInspection}
                    className="flex-1 py-3.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors"
                  >
                    New Inspection
                  </button>
                  <button
                    onClick={() => handleTabChange('history')}
                    className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
                  >
                    View History
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* History Tab */
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Inspection History</h2>
                  <p className="text-sm text-slate-500">
                    {history.length} inspection{history.length !== 1 ? 's' : ''} recorded
                  </p>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search crops or diseases..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-64"
                  />
                </div>
              </div>

              {historyLoading ? (
                <div className="text-center py-12">
                  <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto mb-3" />
                  <p className="text-slate-500">Loading history...</p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History size={40} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">
                    {searchQuery ? 'No matching inspections found' : 'No inspections yet'}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => handleTabChange('inspect')}
                      className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Start First Inspection
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-emerald-200 transition-colors group"
                    >
                      <div className="w-16 h-16 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.crop_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon size={20} className="text-slate-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-slate-800">{item.crop_name}</span>
                          <span className="text-slate-300">·</span>
                          <span className={`text-sm font-medium ${severityTextColor(item.severity)}`}>
                            {item.severity}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 truncate">{item.disease_name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(item.created_at).toLocaleDateString()} · Confidence: {item.confidence}%
                        </p>
                      </div>
                      <button
                        onClick={() => deleteHistoryItem(item.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            <Bug size={14} className="text-emerald-500" />
            Crop Disease Inspector — AI-powered diagnostics for healthier harvests
          </p>
          <p className="text-xs text-slate-400">Results are for guidance. Consult an agronomist for confirmation.</p>
        </div>
      </footer>
    </div>
  );
}
