// Test-only bounded STEP reader. Geometry acceptance belongs to the runner.
// Use headers from official OCCT commit b8f597c677811d1f9f4d8a97f5ae2825c0353a42.
#include <STEPControl_Reader.hxx>
#include <ShapeProcess.hxx>
#include <IFSelect_ReturnStatus.hxx>
#include <IFSelect_PrintCount.hxx>
#include <Interface_Check.hxx>
#include <Interface_CheckIterator.hxx>
#include <XSControl_WorkSession.hxx>
#include <XSControl_TransferReader.hxx>
#include <BRepCheck_Analyzer.hxx>
#include <BRepGProp.hxx>
#include <BRepBndLib.hxx>
#include <BRep_Tool.hxx>
#include <Bnd_Box.hxx>
#include <GProp_GProps.hxx>
#include <NCollection_IndexedMap.hxx>
#include <TopTools_ShapeMapHasher.hxx>
#include <TopExp.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Shape.hxx>
#include <Standard_Failure.hxx>
#include <algorithm>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#include <string>

using ShapeMap = NCollection_IndexedMap<TopoDS_Shape, TopTools_ShapeMapHasher>;

struct CheckCounts
{
  int warnings = 0;
  int failures = 0;
};

static CheckCounts countChecks(const Interface_CheckIterator& checks)
{
  CheckCounts counts;
  for (checks.Start(); checks.More(); checks.Next())
  {
    const auto& check = checks.Value();
    if (check.IsNull())
      throw std::runtime_error("check iterator returned a null check");
    counts.warnings += check->NbWarnings();
    counts.failures += check->NbFails();
  }
  return counts;
}

static void requireEmptyFlags(const STEPControl_Reader& reader)
{
  const auto& flags = reader.GetShapeProcessFlags();
  if (!flags.second || !flags.first.none())
    throw std::runtime_error("shape processing flags are not explicitly empty");
}

static ShapeMap mapShapes(const TopoDS_Shape& shape, TopAbs_ShapeEnum kind)
{
  ShapeMap result;
  TopExp::MapShapes(shape, kind, result);
  return result;
}

static void writeSolidMetrics(std::ostream& output, const TopoDS_Shape& shape)
{
  GProp_GProps properties;
  BRepGProp::VolumeProperties(shape, properties);
  Bnd_Box bounds;
  BRepBndLib::AddOptimal(shape, bounds, false, false);
  bounds.SetGap(0.0);
  if (bounds.IsVoid() || bounds.IsOpen())
    throw std::runtime_error("solid bounds are void or open");
  double xmin, ymin, zmin, xmax, ymax, zmax;
  bounds.Get(xmin, ymin, zmin, xmax, ymax, zmax);
  output << "{\"valid\": " << (BRepCheck_Analyzer(shape, true).IsValid() ? "true" : "false")
    << ", \"volume\": " << properties.Mass()
    << ", \"bbox\": [" << xmin << ", " << ymin << ", " << zmin << ", "
    << xmax << ", " << ymax << ", " << zmax << "]}";
}

int main(int argc, char** argv)
{
  const bool leaveFlagsDefault = argc == 4 && std::string(argv[3]) == "--leave-flags-default";
  if (argc != 3 && !leaveFlagsDefault)
  {
    std::cerr << "usage: reader_probe input.step result.json [--leave-flags-default]\n";
    return 64;
  }
  try
  {
    const std::string resultPath(argv[2]);
    std::ofstream loadDiagnostics(resultPath + ".load.txt");
    std::ofstream transferDiagnostics(resultPath + ".transfer.txt");
    if (!loadDiagnostics || !transferDiagnostics)
      throw std::runtime_error("cannot create diagnostic sidecars");
    STEPControl_Reader reader;
    const auto status = reader.ReadFile(argv[1]);
    loadDiagnostics << "All load warnings and failures by entity:\n";
    reader.PrintCheckLoad(loadDiagnostics, false, IFSelect_ItemsByEntity);
    loadDiagnostics << "\nLoad counts by message:\n";
    reader.PrintCheckLoad(loadDiagnostics, false, IFSelect_CountByItem);
    loadDiagnostics.flush();
    if (!loadDiagnostics)
      throw std::runtime_error("cannot write load diagnostics");
    const auto loadCounts = countChecks(reader.WS()->ModelCheckList());
    if (status != IFSelect_RetDone)
      throw std::runtime_error("ReadFile did not return IFSelect_RetDone");

    // ReadFile initializes transfer state. Set flags after it and before transfer.
    // Do not alter precision settings or call ShapeFix, sewing, or tolerance tools.
    if (leaveFlagsDefault)
    {
      // Deliberate negative control: reject before any potentially healed transfer.
      const auto flags = reader.GetShapeProcessFlags();
      std::ofstream output(argv[2]);
      if (!output)
        throw std::runtime_error("cannot create negative-control result file");
      output << "{\n  \"schema\": \"d406-native-probe-v1\",\n"
        << "  \"control_rejected\": true,\n"
        << "  \"negative_control_leave_flags_default\": true,\n"
        << "  \"postprocess_flags_explicitly_empty_before_and_after\": false,\n"
        << "  \"all_translator_adjustments_disabled\": false,\n"
        << "  \"flags_set_before\": " << (flags.second ? "true" : "false") << ",\n"
        << "  \"flags_empty_before\": " << (flags.first.none() ? "true" : "false") << ",\n"
        << "  \"transfer_executed\": false,\n"
        << "  \"load_warning_count\": " << loadCounts.warnings << ",\n"
        << "  \"load_failure_count\": " << loadCounts.failures << "\n}\n";
      output.flush();
      if (!output)
        throw std::runtime_error("cannot write negative-control result file");
      transferDiagnostics << "NOT RUN: default processing flags deliberately rejected.\n";
      transferDiagnostics.flush();
      if (!transferDiagnostics)
        throw std::runtime_error("cannot write negative-control diagnostics");
      std::cerr << "Control rejected: --leave-flags-default does not disable ShapeProcess.\n";
      return 2;
    }
    reader.SetShapeProcessFlags(ShapeProcess::OperationsFlags{});
    requireEmptyFlags(reader);
    const auto flagsBefore = reader.GetShapeProcessFlags();
    const int roots = reader.NbRootsForTransfer();
    const int transferred = reader.TransferRoots();
    transferDiagnostics << "All transfer warnings and failures by entity:\n";
    reader.PrintCheckTransfer(transferDiagnostics, false, IFSelect_ItemsByEntity);
    transferDiagnostics << "\nTransfer counts by message:\n";
    reader.PrintCheckTransfer(transferDiagnostics, false, IFSelect_CountByItem);
    transferDiagnostics.flush();
    if (!transferDiagnostics)
      throw std::runtime_error("cannot write transfer diagnostics");
    const auto transferCounts = countChecks(reader.WS()->TransferReader()->LastCheckList());
    requireEmptyFlags(reader);
    const auto flagsAfter = reader.GetShapeProcessFlags();
    const auto shape = reader.OneShape();
    if (shape.IsNull())
      throw std::runtime_error("reader returned a null shape");

    const auto solids = mapShapes(shape, TopAbs_SOLID);
    const auto shells = mapShapes(shape, TopAbs_SHELL);
    const auto faces = mapShapes(shape, TopAbs_FACE);
    const auto edges = mapShapes(shape, TopAbs_EDGE);
    const auto vertices = mapShapes(shape, TopAbs_VERTEX);
    double maxTolerance = 0.0;
    for (int i = 1; i <= faces.Extent(); ++i)
      maxTolerance = std::max(maxTolerance, BRep_Tool::Tolerance(TopoDS::Face(faces(i))));
    for (int i = 1; i <= edges.Extent(); ++i)
      maxTolerance = std::max(maxTolerance, BRep_Tool::Tolerance(TopoDS::Edge(edges(i))));
    for (int i = 1; i <= vertices.Extent(); ++i)
      maxTolerance = std::max(maxTolerance, BRep_Tool::Tolerance(TopoDS::Vertex(vertices(i))));

    // These operations inspect the shape. They do not fix it.
    const bool valid = BRepCheck_Analyzer(shape, true).IsValid();
    GProp_GProps properties;
    BRepGProp::VolumeProperties(shape, properties);
    Bnd_Box bounds;
    BRepBndLib::AddOptimal(shape, bounds, false, false);
    bounds.SetGap(0.0);
    if (bounds.IsVoid() || bounds.IsOpen())
      throw std::runtime_error("shape bounds are void or open");
    double xmin, ymin, zmin, xmax, ymax, zmax;
    bounds.Get(xmin, ymin, zmin, xmax, ymax, zmax);

    std::ofstream output(argv[2]);
    if (!output)
      throw std::runtime_error("cannot create result file");
    output << std::setprecision(17)
      << "{\n  \"schema\": \"d406-native-probe-v1\",\n"
      << "  \"control_rejected\": false,\n"
      << "  \"negative_control_leave_flags_default\": false,\n"
      << "  \"postprocess_flags_explicitly_empty_before_and_after\": true,\n"
      << "  \"all_translator_adjustments_disabled\": false,\n"
      << "  \"flags_set_before\": " << (flagsBefore.second ? "true" : "false") << ",\n"
      << "  \"flags_empty_before\": " << (flagsBefore.first.none() ? "true" : "false") << ",\n"
      << "  \"flags_set_after\": " << (flagsAfter.second ? "true" : "false") << ",\n"
      << "  \"flags_empty_after\": " << (flagsAfter.first.none() ? "true" : "false") << ",\n"
      << "  \"transfer_executed\": true,\n"
      << "  \"read_status\": " << static_cast<int>(status) << ",\n"
      << "  \"system_length_unit\": " << reader.SystemLengthUnit() << ",\n"
      << "  \"load_and_transfer_diagnostic_sidecars_written\": true,\n"
      << "  \"load_warning_count\": " << loadCounts.warnings << ",\n"
      << "  \"load_failure_count\": " << loadCounts.failures << ",\n"
      << "  \"transfer_warning_count\": " << transferCounts.warnings << ",\n"
      << "  \"transfer_failure_count\": " << transferCounts.failures << ",\n"
      << "  \"roots\": " << roots << ",\n"
      << "  \"transferred_roots\": " << transferred << ",\n"
      << "  \"shapes\": " << reader.NbShapes() << ",\n"
      << "  \"valid\": " << (valid ? "true" : "false") << ",\n"
      << "  \"solids\": " << solids.Extent() << ",\n"
      << "  \"shells\": " << shells.Extent() << ",\n"
      << "  \"faces\": " << faces.Extent() << ",\n"
      << "  \"edges\": " << edges.Extent() << ",\n"
      << "  \"vertices\": " << vertices.Extent() << ",\n"
      << "  \"volume\": " << properties.Mass() << ",\n"
      << "  \"max_tolerance\": " << maxTolerance << ",\n"
      << "  \"bbox\": [" << xmin << ", " << ymin << ", " << zmin << ", "
      << xmax << ", " << ymax << ", " << zmax << "],\n"
      << "  \"per_solid\": [";
    for (int i = 1; i <= solids.Extent(); ++i)
    {
      if (i > 1) output << ", ";
      writeSolidMetrics(output, solids(i));
    }
    output << "]\n}\n";
    output.flush();
    if (!output)
      throw std::runtime_error("cannot write result file");
    // The owner must apply the existing D404 prismatic gates to these metrics.
    return 0;
  }
  catch (const Standard_Failure& error)
  {
    std::cerr << "OCCT failure: " << error.what() << '\n';
  }
  catch (const std::exception& error)
  {
    std::cerr << "Probe failure: " << error.what() << '\n';
  }
  return 1;
}
