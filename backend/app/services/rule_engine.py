import logging
from typing import Dict, Any

logger = logging.getLogger("app.services.rule_engine")

class RuleEngine:
    """Evaluates rules against incoming GitHub webhook event payloads."""

    @staticmethod
    def evaluate_rule(payload: Dict[str, Any], event_type: str, rule_conditions: Dict[str, Any]) -> bool:
        """
        Validates whether the payload matches the condition parameters.
        
        Example condition:
        {
            "field": "title",
            "operator": "contains",
            "value": "bug"
        }
        """
        if not rule_conditions:
            # Empty conditions match everything by default
            return True

        field = rule_conditions.get("field")
        operator = rule_conditions.get("operator")
        target_value = rule_conditions.get("value")

        if not field or not operator or target_value is None:
            logger.warning("Malformed rule condition layout: %s", rule_conditions)
            return False

        # Extract actual value dynamically depending on event type context
        actual_value = None
        if event_type == "issues":
            actual_value = payload.get("issue", {}).get(field)
        elif event_type == "pull_request":
            actual_value = payload.get("pull_request", {}).get(field)

        if actual_value is None:
            return False

        # Normalize comparisons to lower-case string values
        actual_value_str = str(actual_value).lower()
        target_value_str = str(target_value).lower()

        if operator == "contains":
            return target_value_str in actual_value_str
        elif operator == "equals":
            return actual_value_str == target_value_str
        elif operator == "starts_with":
            return actual_value_str.startswith(target_value_str)
        elif operator == "ends_with":
            return actual_value_str.endswith(target_value_str)

        logger.warning("Unsupported operator '%s' defined in rule condition.", operator)
        return False
