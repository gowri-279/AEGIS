# P2 ? Sensor Intelligence and Risk Assessment

## Responsibilities
- Simulate synthetic sensor readings and failure modes.
- Assess freshness, validity, usability, confidence, and sensor issues.
- Gate downstream evaluation when critical sensor WL-J3 is unusable.
- Report risks only when supported by supplied readings and modeled data.
- Report downstream capacity as `not_evaluated` when it is not modeled.

P2 does not select routes, rank candidates, or claim real-world hydraulic
safety. Risk-confidence values are illustrative and are not calibrated
probabilities. All demonstration values are synthetic.

## Run the demo
From the repository root:

```powershell
py -m p2.demo
```

The demo shows normal readings, a stale critical sensor, and a modeled
edge overload.

## Run tests
```powershell
py -m unittest discover -s tests -v
```
